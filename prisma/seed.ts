import {
  PrismaClient,
  ReadingStatus,
  UserRole,
  InputMethod,
  InvoiceStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { calculateTotal } from "../lib/billing";
import { unitPriceForHousehold } from "../lib/routePricing";
import {
  COLLECTION_ROUTES,
  PRICE_GROUPS,
  TEST_RESIDENT_ACCOUNTS,
  adminDisplayName,
  demoResidentName,
  randomAddress,
  randomResidentName,
} from "../lib/seed-data";
import { assertDestructiveAllowed } from "../lib/destructiveDbGuard";

assertDestructiveAllowed("prisma/seed");

const prisma = new PrismaClient();

/** Số hộ chính (không tính 20 hộ test). */
const HOUSEHOLD_COUNT = 80;
const DEMO_PASSWORD = "123456";

function periodLabel(year: number, month: number) {
  return `Tháng ${month}/${year}`;
}

type HouseholdWithRoute = {
  id: string;
  priceGroup: { unitPrice: number };
  collectionRoute: { unitPrice: number | null } | null;
};

async function seedInvoiceForReading(
  household: HouseholdWithRoute,
  periodId: string,
  usageM3: number,
  opts?: { paid?: boolean }
) {
  const unitPrice = unitPriceForHousehold(household);
  const { calculateBillingAmounts } = await import("../lib/vat");
  const amounts = calculateBillingAmounts(usageM3, unitPrice, 10);
  const invoice = await prisma.invoice.create({
    data: {
      householdId: household.id,
      periodId,
      usageM3,
      unitPrice,
      subtotalAmount: amounts.subtotal,
      vatPercent: amounts.vatPercent,
      vatAmount: amounts.vatAmount,
      totalAmount: amounts.totalAmount,
      status: opts?.paid ? InvoiceStatus.PAID : InvoiceStatus.ISSUED,
      issuedAt: new Date(),
    },
  });
  if (opts?.paid) {
    const admin = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
      select: { id: true },
    });
    await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: amounts.totalAmount,
        method: "CASH",
        note: "Seed demo",
        confirmedAt: new Date(),
        confirmedById: admin?.id,
      },
    });
  }
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.meterReading.deleteMany();
  await prisma.household.deleteMany();
  await prisma.collectionRoute.deleteMany();
  await prisma.user.deleteMany();
  await prisma.billingPeriod.deleteMany();
  await prisma.priceGroup.deleteMany();
  await prisma.systemSettings.deleteMany();

  const priceGroups = await Promise.all(
    PRICE_GROUPS.map((g) =>
      prisma.priceGroup.create({
        data: { code: g.code, name: g.name, unitPrice: g.unitPrice },
      })
    )
  );

  const routes = await Promise.all(
    COLLECTION_ROUTES.map((r) =>
      prisma.collectionRoute.create({
        data: {
          code: r.code,
          name: r.name,
          sortOrder: r.sortOrder,
          unitPrice: r.unitPrice,
        },
      })
    )
  );

  await prisma.systemSettings.create({
    data: { id: "default", periodCloseDay: 25 },
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await prisma.user.create({
    data: {
      phone: "admin",
      passwordHash,
      name: adminDisplayName(),
      role: UserRole.ADMIN,
    },
  });

  const now = new Date();
  const periods: { id: string; year: number; month: number }[] = [];
  for (let i = 3; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const p = await prisma.billingPeriod.create({
      data: {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        status: "CLOSED",
      },
    });
    periods.push(p);
  }
  const currentPeriod = await prisma.billingPeriod.create({
    data: { year: now.getFullYear(), month: now.getMonth() + 1 },
  });
  periods.push(currentPeriod);

  const demoResident = await prisma.user.create({
    data: {
      phone: "0912345678",
      passwordHash,
      name: demoResidentName(),
      role: UserRole.RESIDENT,
    },
  });

  const routeCount = routes.length;
  const perRoute = Math.ceil(HOUSEHOLD_COUNT / routeCount);

  let pendingCount = 0;
  let confirmedCount = 0;
  let noReadingCount = 0;
  let rejectedCount = 0;
  let invoiceCount = 0;

  for (let i = 1; i <= HOUSEHOLD_COUNT; i++) {
    const routeIndex = Math.min(routeCount - 1, Math.floor((i - 1) / perRoute));
    const route = routes[routeIndex];
    const routeSeq = ((i - 1) % perRoute) + 1;
    const routeKey = route.code.replace(/-/g, "").toUpperCase();
    const mkh = `${routeKey}${String(routeSeq).padStart(3, "0")}`;

    const meterCode = `DH${String(i).padStart(5, "0")}`;
    const baseReading = 100 + (i % 80);
    const pg = priceGroups[i % 2];
    const userId = i === 1 ? demoResident.id : undefined;

    const household = await prisma.household.create({
      data: {
        householdCode: mkh,
        meterCode,
        address: randomAddress(i),
        residentName: i === 1 ? demoResidentName() : randomResidentName(i),
        contactPhone: i === 1 ? "0912345678" : undefined,
        priceGroupId: pg.id,
        userId,
        collectionRouteId: route.id,
        routeSortOrder: routeSeq,
      },
      include: {
        priceGroup: true,
        collectionRoute: { select: { unitPrice: true } },
      },
    });

    let prevConfirmed = baseReading;
    for (const period of periods.slice(0, 3)) {
      const usage = 8 + (i % 7) + (period.month % 3);
      const confirmed = prevConfirmed + usage;
      await prisma.meterReading.create({
        data: {
          householdId: household.id,
          periodId: period.id,
          oldReading: prevConfirmed,
          ocrValue: confirmed,
          confirmedValue: confirmed,
          confidence: 85 + (i % 10),
          inputMethod: InputMethod.OCR_CONFIRMED,
          usageM3: usage,
          anomalyFlags: "[]",
          status: ReadingStatus.CONFIRMED,
          confirmedAt: new Date(period.year, period.month - 1, 15),
        },
      });
      prevConfirmed = confirmed;
    }

    const usageNow = 8 + (i % 6);
    const csmNow = prevConfirmed + usageNow;

    if (i % 7 === 0) {
      noReadingCount++;
      continue;
    }

    if (i % 13 === 0) {
      await prisma.meterReading.create({
        data: {
          householdId: household.id,
          periodId: currentPeriod.id,
          oldReading: prevConfirmed,
          ocrValue: csmNow,
          confirmedValue: csmNow,
          usageM3: usageNow,
          status: ReadingStatus.REJECTED,
          anomalyFlags: "[]",
        },
      });
      rejectedCount++;
      continue;
    }

    if (i % 5 === 0) {
      await prisma.meterReading.create({
        data: {
          householdId: household.id,
          periodId: currentPeriod.id,
          oldReading: prevConfirmed,
          ocrValue: csmNow,
          status: ReadingStatus.PENDING,
          anomalyFlags: "[]",
        },
      });
      pendingCount++;
      continue;
    }

    await prisma.meterReading.create({
      data: {
        householdId: household.id,
        periodId: currentPeriod.id,
        oldReading: prevConfirmed,
        confirmedValue: csmNow,
        usageM3: usageNow,
        inputMethod: InputMethod.MANUAL,
        status: ReadingStatus.CONFIRMED,
        confirmedAt: new Date(),
        anomalyFlags: "[]",
      },
    });
    confirmedCount++;
    await seedInvoiceForReading(household, currentPeriod.id, usageNow, {
      paid: i % 17 === 0,
    });
    invoiceCount++;
  }

  const testRoute = routes[0];
  const testPg = priceGroups[0];
  for (const t of TEST_RESIDENT_ACCOUNTS) {
    const user = await prisma.user.create({
      data: {
        phone: t.phone,
        passwordHash,
        name: t.name,
        role: UserRole.RESIDENT,
      },
    });

    const baseReading = 200 + parseInt(t.mkh.replace(/\D/g, ""), 10);
    const household = await prisma.household.create({
      data: {
        householdCode: t.mkh,
        meterCode: t.meterCode,
        address: `Nhà test — ${testRoute.name}`,
        residentName: t.name,
        contactPhone: t.phone,
        priceGroupId: testPg.id,
        userId: user.id,
        collectionRouteId: testRoute.id,
        routeSortOrder: 900,
      },
      include: {
        priceGroup: true,
        collectionRoute: { select: { unitPrice: true } },
      },
    });

    let prev = baseReading;
    for (const period of periods.slice(0, 3)) {
      const usage = 10;
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
          confirmedAt: new Date(period.year, period.month - 1, 10),
          anomalyFlags: "[]",
        },
      });
      prev = confirmed;
    }
    noReadingCount++;
  }

  const totalHouseholds = HOUSEHOLD_COUNT + TEST_RESIDENT_ACCOUNTS.length;

  console.log("\n=== Dataset demo đã sẵn sàng ===\n");
  console.log(`Kỳ hiện tại: ${periodLabel(currentPeriod.year, currentPeriod.month)}`);
  console.log(`Hộ: ${totalHouseholds} (${HOUSEHOLD_COUNT} chính + ${TEST_RESIDENT_ACCOUNTS.length} test)`);
  console.log(`Kỳ này — chưa gửi: ${noReadingCount} · chờ chốt: ${pendingCount} · từ chối: ${rejectedCount} · đã chốt: ${confirmedCount} · hóa đơn: ${invoiceCount}`);
  console.log("\nKhu vực / giá (đ/m³):");
  for (const r of routes) {
    console.log(`  · ${r.name}: ${r.unitPrice?.toLocaleString("vi-VN")}`);
  }
  console.log("\nĐăng nhập:");
  console.log(`  Admin: admin / ${DEMO_PASSWORD}`);
  console.log(`  Hộ demo (đã chốt kỳ này): 0912345678 / ${DEMO_PASSWORD} — MKH 212001`);
  console.log(`  Hộ test (chưa gửi CSM): 0920000001 … 0920000020 / ${DEMO_PASSWORD}`);
  console.log(`  Ví dụ MKH test: TEST001 … TEST020\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
