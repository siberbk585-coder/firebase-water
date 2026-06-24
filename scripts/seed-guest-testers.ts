/**
 * 20 tài khoản Guest (guest01…guest20) — mỗi tài khoản 1 tuyến test riêng, không đụng dữ liệu thật.
 *
 *   cloud-sql-proxy tiennuoc:asia-southeast1:tiennuoc-db --port 5433
 *   CLOUDSQL_PORT=5433 npm run db:seed-guest-testers
 *   npm run firebase:provision-guest-testers
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import {
  HouseholdStatus,
  PeriodStatus,
  ReadingStatus,
  UserRole,
} from "@prisma/client";
import { createPrismaTiennuoc } from "./prisma-tiennuoc";

const GUEST_COUNT = 20;
const HOUSEHOLDS_PER_GUEST = 20;
const PASSWORD = "GuestTest2026!";
const ROUTE_PREFIX = "GUEST";
const OUT_FILE = resolve(
  process.cwd(),
  "scripts/data/guest-testers-credentials.txt",
);

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function usernameFor(n: number): string {
  return `guest${pad2(n)}`;
}

function routeCodeFor(n: number): string {
  return `${ROUTE_PREFIX}-${pad2(n)}`;
}

function collectorInternalPhone(username: string): string {
  return `collector:${username.trim().toLowerCase()}`;
}

function householdsForGuest(n: number) {
  const p = pad2(n);
  const list: {
    householdCode: string;
    meterCode: string;
    residentName: string;
    address: string;
    oldReading: number;
    routeSortOrder: number;
  }[] = [];

  for (let i = 1; i <= HOUSEHOLDS_PER_GUEST; i++) {
    const hi = pad2(i);
    list.push({
      householdCode: `GST${p}H${hi}`,
      meterCode: `MGST${p}${hi}`,
      residentName: `HỘ TEST GUEST ${p} — ${hi}`,
      address: `Khu test guest ${p} — hộ ${hi} — không phải hộ thật`,
      oldReading: 50 + n * 10 + i * 8,
      routeSortOrder: i,
    });
  }
  return list;
}

async function clearStaleInvoices(
  prisma: Awaited<ReturnType<typeof createPrismaTiennuoc>>,
  householdId: string,
  periodId: string,
) {
  const staleInvoices = await prisma.invoice.findMany({
    where: { householdId, periodId },
    select: { id: true },
  });
  if (!staleInvoices.length) return;
  await prisma.payment.deleteMany({
    where: { invoiceId: { in: staleInvoices.map((i) => i.id) } },
  });
  await prisma.invoice.deleteMany({
    where: { id: { in: staleInvoices.map((i) => i.id) } },
  });
}

async function main() {
  const prisma = await createPrismaTiennuoc();
  const lines: string[] = [
    "# Tài khoản Guest tester — CHỈ dùng thử, không phải dữ liệu thật",
    `# Tạo: ${new Date().toISOString()}`,
    "# Đăng nhập app: nhập username vào ô «Số điện thoại»",
    "",
    "STT\tUsername\tPassword\tTuyến\tGhi chú",
  ];

  try {
    const priceGroup = await prisma.priceGroup.findFirst({
      orderBy: { code: "asc" },
    });
    if (!priceGroup) {
      throw new Error("Chưa có price group — chạy seed/migrate trước.");
    }

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

    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    for (let n = 1; n <= GUEST_COUNT; n++) {
      const username = usernameFor(n);
      const routeCode = routeCodeFor(n);
      const routeName = `Guest tester ${pad2(n)} (chỉ test)`;

      const route = await prisma.collectionRoute.upsert({
        where: { code: routeCode },
        create: {
          code: routeCode,
          name: routeName,
          sortOrder: 9000 + n,
          unitPrice: priceGroup.unitPrice,
        },
        update: { name: routeName, sortOrder: 9000 + n },
      });

      for (const h of householdsForGuest(n)) {
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

        await clearStaleInvoices(prisma, household.id, period.id);
      }

      const phone = collectorInternalPhone(username);
      const user = await prisma.user.upsert({
        where: { username },
        create: {
          phone,
          username,
          name: `Guest Tester ${pad2(n)}`,
          passwordHash,
          role: UserRole.COLLECTOR,
          isActive: true,
          collectorRoutes: { create: [{ routeId: route.id }] },
        },
        update: {
          phone,
          name: `Guest Tester ${pad2(n)}`,
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

      lines.push(
        `${n}\t${username}\t${PASSWORD}\t${routeCode}\t${HOUSEHOLDS_PER_GUEST} hộ test GST${pad2(n)}H01–H${pad2(HOUSEHOLDS_PER_GUEST)}`,
      );
      console.log(`✔ ${username} → ${routeCode} (${HOUSEHOLDS_PER_GUEST} hộ)`);
    }

    mkdirSync(resolve(process.cwd(), "scripts/data"), { recursive: true });
    writeFileSync(OUT_FILE, `${lines.join("\n")}\n`, "utf8");

    console.log(`\n✔ ${GUEST_COUNT} tài khoản Guest — kỳ ${period.month}/${period.year}`);
    console.log(`✔ Danh sách: ${OUT_FILE}`);
    console.log("\nTiếp theo:");
    console.log("  npm run firebase:provision-guest-testers");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
