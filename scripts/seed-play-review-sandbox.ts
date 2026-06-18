/**
 * Sandbox CH Play — tài khoản reviewer chỉ thấy tuyến test, không đụng tuyến thật.
 *
 *   cloud-sql-proxy tiennuoc:asia-southeast1:tiennuoc-db --port 5434
 *   npm run db:seed-play-review
 *   npm run firebase:provision-auth -- --account playreview --password 'PlayReview2026!'
 */
import bcrypt from "bcryptjs";
import {
  HouseholdStatus,
  PeriodStatus,
  ReadingStatus,
  UserRole,
} from "@prisma/client";
import { createPrismaTiennuoc } from "./prisma-tiennuoc";

const USERNAME = "playreview";
const PASSWORD = "PlayReview2026!";
const ROUTE_CODE = "PLAY-REVIEW";
const ROUTE_NAME = "Google Play Review (chỉ test)";

const TEST_HOUSEHOLDS = [
  {
    householdCode: "PLAYREV001",
    meterCode: "MPLAY001",
    residentName: "HO TEST GOOGLE PLAY 1",
    address: "Khu vực test reviewer — không phải hộ thật",
    oldReading: 100,
    routeSortOrder: 1,
  },
  {
    householdCode: "PLAYREV002",
    meterCode: "MPLAY002",
    residentName: "HO TEST GOOGLE PLAY 2",
    address: "Khu vực test reviewer — không phải hộ thật",
    oldReading: 250,
    routeSortOrder: 2,
  },
] as const;

function collectorInternalPhone(username: string): string {
  return `collector:${username.trim().toLowerCase()}`;
}

async function main() {
  const prisma = await createPrismaTiennuoc();
  try {
    await run(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function run(prisma: Awaited<ReturnType<typeof createPrismaTiennuoc>>) {

  const priceGroup = await prisma.priceGroup.findFirst({
    orderBy: { code: "asc" },
  });
  if (!priceGroup) {
    throw new Error("Chưa có price group — chạy seed/migrate trước.");
  }

  const route = await prisma.collectionRoute.upsert({
    where: { code: ROUTE_CODE },
    create: {
      code: ROUTE_CODE,
      name: ROUTE_NAME,
      sortOrder: 9999,
      unitPrice: priceGroup.unitPrice,
    },
    update: { name: ROUTE_NAME, sortOrder: 9999 },
  });

  const period =
    (await prisma.billingPeriod.findFirst({
      where: { status: PeriodStatus.OPEN },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    })) ??
    (await prisma.billingPeriod.findFirst({
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }));
  if (!period) {
    throw new Error("Chưa có kỳ thu — tạo kỳ trên web admin trước.");
  }

  for (const h of TEST_HOUSEHOLDS) {
    const household = await prisma.household.upsert({
      where: { householdCode: h.householdCode },
      create: {
        householdCode: h.householdCode,
        meterCode: h.meterCode,
        residentName: h.residentName,
        address: h.address,
        status: HouseholdStatus.ACTIVE,
        paymentMethod: "CASH",
        collectionRouteId: route.id,
        routeSortOrder: h.routeSortOrder,
        priceGroupId: priceGroup.id,
      },
      update: {
        residentName: h.residentName,
        address: h.address,
        status: HouseholdStatus.ACTIVE,
        collectionRouteId: route.id,
        routeSortOrder: h.routeSortOrder,
      },
    });

    await prisma.meterReading.upsert({
      where: {
        householdId_periodId: {
          householdId: household.id,
          periodId: period.id,
        },
      },
      create: {
        householdId: household.id,
        periodId: period.id,
        oldReading: h.oldReading,
        status: ReadingStatus.PENDING,
      },
      update: {
        oldReading: h.oldReading,
        status: ReadingStatus.PENDING,
        confirmedValue: null,
        usageM3: null,
        confirmedAt: null,
      },
    });

    const staleInvoices = await prisma.invoice.findMany({
      where: { householdId: household.id, periodId: period.id },
      select: { id: true },
    });
    if (staleInvoices.length) {
      await prisma.payment.deleteMany({
        where: { invoiceId: { in: staleInvoices.map((i) => i.id) } },
      });
      await prisma.invoice.deleteMany({
        where: { id: { in: staleInvoices.map((i) => i.id) } },
      });
    }
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const phone = collectorInternalPhone(USERNAME);

  const user = await prisma.user.upsert({
    where: { username: USERNAME },
    create: {
      phone,
      username: USERNAME,
      name: "Google Play Review",
      passwordHash,
      role: UserRole.COLLECTOR,
      isActive: true,
      collectorRoutes: { create: [{ routeId: route.id }] },
    },
    update: {
      phone,
      name: "Google Play Review",
      passwordHash,
      role: UserRole.COLLECTOR,
      isActive: true,
    },
  });

  await prisma.collectorRoute.deleteMany({
    where: { userId: user.id, routeId: { not: route.id } },
  });
  await prisma.collectorRoute.upsert({
    where: {
      userId_routeId: { userId: user.id, routeId: route.id },
    },
    create: { userId: user.id, routeId: route.id },
    update: {},
  });

  console.log("\n✔ Sandbox CH Play đã sẵn sàng\n");
  console.log("Đăng nhập app (ô Số điện thoại — nhập username):");
  console.log(`  Username: ${USERNAME}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`\nTuyến gán: ${ROUTE_CODE} — ${TEST_HOUSEHOLDS.length} hộ test`);
  console.log(`Kỳ: ${period.month}/${period.year} (${period.status})`);
  console.log("\nTiếp theo:");
  console.log(
    `  npm run firebase:provision-auth -- --account ${USERNAME} --password '${PASSWORD}'`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
