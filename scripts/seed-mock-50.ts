/**
 * Thêm ~50 hộ mock vào Postgres (tiennuoc / Data Connect).
 * Phân bổ đều 8 khu vực; kỳ hiện tại có đủ PENDING / CONFIRMED / REJECTED / chưa nhập.
 *
 *   npm run firebase:seed-mock-50
 *   npm run firebase:provision-auth   # sau khi seed
 */
import {
  ReadingStatus,
  UserRole,
  InputMethod,
  InvoiceStatus,
  HouseholdStatus,
  PeriodStatus,
} from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { createPrismaTiennuoc } from "./prisma-tiennuoc";
import bcrypt from "bcryptjs";
import {
  COLLECTION_ROUTES,
  PRICE_GROUPS,
  randomAddress,
  randomResidentName,
} from "../lib/seed-data";
import { calculateTotal } from "../lib/billing";
import { unitPriceForHousehold } from "../lib/routePricing";

const RESIDENT_COUNT = 50;
const PASSWORD = "123456";
const PHONE_PREFIX = "093100";

async function ensureBase(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const priceGroups = await Promise.all(
    PRICE_GROUPS.map((g) =>
      prisma.priceGroup.upsert({
        where: { code: g.code },
        create: { code: g.code, name: g.name, unitPrice: g.unitPrice },
        update: { name: g.name, unitPrice: g.unitPrice },
      })
    )
  );

  const routes = await Promise.all(
    COLLECTION_ROUTES.map((r) =>
      prisma.collectionRoute.upsert({
        where: { code: r.code },
        create: {
          code: r.code,
          name: r.name,
          sortOrder: r.sortOrder,
          unitPrice: r.unitPrice,
        },
        update: { name: r.name, sortOrder: r.sortOrder, unitPrice: r.unitPrice },
      })
    )
  );

  await prisma.systemSettings.upsert({
    where: { id: "default" },
    create: { id: "default", periodCloseDay: 25 },
    update: {},
  });

  await prisma.user.upsert({
    where: { phone: "admin" },
    create: {
      phone: "admin",
      name: "Ban quản lý",
      role: UserRole.ADMIN,
      passwordHash,
    },
    update: { passwordHash, role: UserRole.ADMIN },
  });

  const now = new Date();
  const periods: { id: string; year: number; month: number; status: PeriodStatus }[] = [];

  for (let i = 2; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth() + 1;
    const isOlderClosed = i === 2;
    const p = await prisma.billingPeriod.upsert({
      where: { year_month: { year: d.getFullYear(), month } },
      create: {
        year: d.getFullYear(),
        month,
        status: isOlderClosed ? PeriodStatus.CLOSED : PeriodStatus.OPEN,
      },
      update: {
        status: isOlderClosed ? PeriodStatus.CLOSED : PeriodStatus.OPEN,
      },
    });
    periods.push(p);
  }

  const current = await prisma.billingPeriod.upsert({
    where: {
      year_month: { year: now.getFullYear(), month: now.getMonth() + 1 },
    },
    create: { year: now.getFullYear(), month: now.getMonth() + 1 },
    update: { status: PeriodStatus.OPEN },
  });
  periods.push(current);

  return { priceGroups, routes, periods, current, passwordHash };
}

type Hh = {
  id: string;
  priceGroup: { unitPrice: number };
  collectionRoute: { unitPrice: number | null } | null;
};

async function seedInvoice(
  prisma: PrismaClient,
  household: Hh,
  periodId: string,
  usageM3: number,
  status: InvoiceStatus
) {
  const unitPrice = unitPriceForHousehold(household);
  const totalAmount = calculateTotal(usageM3, unitPrice);
  const invoice = await prisma.invoice.upsert({
    where: {
      householdId_periodId: { householdId: household.id, periodId },
    },
    create: {
      householdId: household.id,
      periodId,
      usageM3,
      unitPrice,
      totalAmount,
      status,
      issuedAt: status !== InvoiceStatus.DRAFT ? new Date() : null,
    },
    update: { usageM3, unitPrice, totalAmount, status },
  });

  if (status === InvoiceStatus.PAID) {
    const admin = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
      select: { id: true },
    });
    await prisma.payment.upsert({
      where: { invoiceId: invoice.id },
      create: {
        invoiceId: invoice.id,
        amount: totalAmount,
        method: "CASH",
        note: "Mock seed",
        confirmedAt: new Date(),
        confirmedById: admin?.id,
      },
      update: { amount: totalAmount, confirmedAt: new Date() },
    });
  }
}

async function main() {
  if (process.env.DATABASE_URL?.includes("firebase_water")) {
    delete process.env.DATABASE_URL;
  }

  const prisma = await createPrismaTiennuoc();
  try {
  const { priceGroups, routes, periods, current, passwordHash } = await ensureBase(prisma);
  const closedPeriods = periods
    .filter((p) => p.id !== current.id)
    .sort((a, b) => a.year - b.year || a.month - b.month);
  const marchPeriod = closedPeriods[0];
  const aprilPeriod = closedPeriods[1];
  const routeCount = routes.length;
  let aprilOpenSlots = 8;

  const stats = {
    created: 0,
    skipped: 0,
    byRoute: new Map<string, number>(),
    reading: { pending: 0, confirmed: 0, rejected: 0, none: 0 },
    invoice: { draft: 0, issued: 0, paid: 0, none: 0 },
    household: { active: 0, inactive: 0 },
  };

  for (let i = 1; i <= RESIDENT_COUNT; i++) {
    const phone = `${PHONE_PREFIX}${String(i).padStart(4, "0")}`;
    if (await prisma.user.findUnique({ where: { phone } })) {
      stats.skipped++;
      continue;
    }

    const routeIndex = (i - 1) % routeCount;
    const route = routes[routeIndex]!;
    const routeSeq = Math.floor((i - 1) / routeCount) + 1;
    const routeKey = route.code.replace(/-/g, "").toUpperCase().slice(0, 6);
    const mkh = `M${routeKey}${String(routeSeq).padStart(2, "0")}`;
    const meterCode = `MK${String(i).padStart(5, "0")}`;

    const hStatus = i % 10 === 0 ? HouseholdStatus.INACTIVE : HouseholdStatus.ACTIVE;
    if (hStatus === HouseholdStatus.ACTIVE) stats.household.active++;
    else stats.household.inactive++;

    const user = await prisma.user.create({
      data: {
        phone,
        passwordHash,
        name: randomResidentName(i),
        role: UserRole.RESIDENT,
      },
    });

    const pg = priceGroups[i % priceGroups.length]!;
    const household = await prisma.household.create({
      data: {
        householdCode: mkh,
        meterCode,
        address: randomAddress(i),
        residentName: user.name,
        contactPhone: phone,
        status: hStatus,
        priceGroupId: pg.id,
        collectionRouteId: route.id,
        routeSortOrder: routeSeq,
        userId: user.id,
      },
      include: {
        priceGroup: true,
        collectionRoute: { select: { unitPrice: true } },
      },
    });

    stats.byRoute.set(route.name, (stats.byRoute.get(route.name) ?? 0) + 1);
    stats.created++;

    const baseReading = 150 + (i % 60) * 2;
    let prev = baseReading;

    for (const period of closedPeriods) {
      const usage = 9 + (i % 6);
      const isMarch = marchPeriod && period.id === marchPeriod.id;
      const isApril = aprilPeriod && period.id === aprilPeriod.id;
      const skipAprilClose =
        isApril && hStatus === HouseholdStatus.ACTIVE && aprilOpenSlots > 0;

      if (skipAprilClose) {
        aprilOpenSlots--;
        continue;
      }

      const confirmed = prev + usage;
      await prisma.meterReading.create({
        data: {
          householdId: household.id,
          periodId: period.id,
          oldReading: prev,
          confirmedValue: confirmed,
          usageM3: usage,
          inputMethod: InputMethod.MANUAL,
          status: ReadingStatus.CONFIRMED,
          confirmedAt: new Date(period.year, period.month - 1, 12),
          anomalyFlags: "[]",
        },
      });
      const invStatus = isMarch
        ? InvoiceStatus.PAID
        : isApril
          ? InvoiceStatus.ISSUED
          : i % 3 === 0
            ? InvoiceStatus.PAID
            : i % 3 === 1
              ? InvoiceStatus.ISSUED
              : InvoiceStatus.DRAFT;
      await seedInvoice(prisma, household, period.id, usage, invStatus);
      prev = confirmed;
    }

    const usageNow = 8 + (i % 8);
    const csmNow = prev + usageNow;
    const bucket = i % 4;

    if (bucket === 0) {
      await prisma.meterReading.create({
        data: {
          householdId: household.id,
          periodId: current.id,
          oldReading: prev,
          ocrValue: csmNow,
          usageM3: usageNow,
          status: ReadingStatus.PENDING,
          inputMethod: InputMethod.OCR_CONFIRMED,
          confidence: 72 + (i % 20),
          anomalyFlags: "[]",
        },
      });
      stats.reading.pending++;
      stats.invoice.none++;
    } else if (bucket === 1) {
      await prisma.meterReading.create({
        data: {
          householdId: household.id,
          periodId: current.id,
          oldReading: prev,
          confirmedValue: csmNow,
          usageM3: usageNow,
          status: ReadingStatus.CONFIRMED,
          inputMethod: InputMethod.MANUAL,
          confirmedAt: new Date(),
          anomalyFlags: "[]",
        },
      });
      stats.reading.confirmed++;
      const inv =
        i % 3 === 0
          ? InvoiceStatus.PAID
          : i % 3 === 1
            ? InvoiceStatus.ISSUED
            : InvoiceStatus.DRAFT;
      await seedInvoice(prisma, household, current.id, usageNow, inv);
      if (inv === InvoiceStatus.PAID) stats.invoice.paid++;
      else if (inv === InvoiceStatus.ISSUED) stats.invoice.issued++;
      else stats.invoice.draft++;
    } else if (bucket === 2) {
      await prisma.meterReading.create({
        data: {
          householdId: household.id,
          periodId: current.id,
          oldReading: prev,
          ocrValue: csmNow,
          confirmedValue: csmNow,
          usageM3: usageNow,
          status: ReadingStatus.REJECTED,
          anomalyFlags: JSON.stringify(["HIGH_USAGE"]),
        },
      });
      stats.reading.rejected++;
      stats.invoice.none++;
    } else {
      stats.reading.none++;
      stats.invoice.none++;
    }
  }

  console.log(`Kỳ hiện tại: Tháng ${current.month}/${current.year}`);
  console.log(`Mật khẩu hộ mock: ${PASSWORD}`);
  console.log(`Đã tạo ${stats.created} hộ, bỏ qua ${stats.skipped} (SĐT trùng).`);
  console.log("\nPhân bổ khu vực:");
  for (const [name, n] of [...stats.byRoute.entries()].sort()) {
    console.log(`  ${name}: ${n} hộ`);
  }
  console.log("\nChỉ số kỳ hiện tại:");
  console.log(
    `  PENDING: ${stats.reading.pending} | CONFIRMED: ${stats.reading.confirmed} | REJECTED: ${stats.reading.rejected} | Chưa nhập: ${stats.reading.none}`
  );
  console.log("\nHóa đơn kỳ hiện tại (hộ đã chốt):");
  console.log(
    `  DRAFT: ${stats.invoice.draft} | ISSUED: ${stats.invoice.issued} | PAID: ${stats.invoice.paid}`
  );
  console.log(`\nHộ INACTIVE: ${stats.household.inactive} / ACTIVE: ${stats.household.active}`);
  console.log("\nTiếp theo: npm run firebase:provision-auth");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
