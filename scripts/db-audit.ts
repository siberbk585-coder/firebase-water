/**
 * Kiểm tra DB đang kết nối — không ghi dữ liệu.
 *   npm run db:audit
 */
import { PrismaClient } from "@prisma/client";
import {
  getDatabaseUrl,
  isProductionDatabase,
} from "../lib/destructiveDbGuard";
import { createPrismaTiennuoc } from "./prisma-tiennuoc";

const MOCK_PHONE_PREFIX = "0931000";

async function main() {
  const url = getDatabaseUrl();
  const prod = isProductionDatabase(url);

  console.log("=== Kiểm tra database ===\n");
  console.log("Production (tiennuoc):", prod ? "CÓ — coi là dữ liệu thật" : "không");
  console.log(
    "URL (rút gọn):",
    url ? url.replace(/:([^:@/]+)@/, ":***@").slice(0, 120) : "(trống — dùng proxy/IAM)"
  );

  const prisma = url
    ? new PrismaClient()
    : await createPrismaTiennuoc();

  try {
    const [
      households,
      users,
      readings,
      invoices,
      periods,
      mockPhones,
    ] = await Promise.all([
      prisma.household.count(),
      prisma.user.count(),
      prisma.meterReading.count(),
      prisma.invoice.count(),
      prisma.billingPeriod.findMany({
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 6,
        select: { year: true, month: true, status: true },
      }),
      prisma.user.count({
        where: { phone: { startsWith: MOCK_PHONE_PREFIX } },
      }),
    ]);

    console.log("\n--- Thống kê ---");
    console.log("Hộ:", households);
    console.log("User:", users);
    console.log(`User mock (${MOCK_PHONE_PREFIX}*):`, mockPhones);
    console.log("Chỉ số:", readings);
    console.log("Hóa đơn:", invoices);
    console.log("Kỳ gần nhất:", periods.map((p) => `T${p.month}/${p.year} ${p.status}`).join(", "));

    console.log("\n--- Script bị chặn trên production (trừ khi ALLOW_DESTRUCTIVE_DB) ---");
    for (const s of [
      "db:seed / db:reset",
      "db:reshape-mock-periods",
      "firebase:seed-mock-50",
      "db:update-addresses-haiphong",
      "firebase:seed-demo",
    ]) {
      console.log(" •", s);
    }

    console.log("\n--- Deploy App Hosting ---");
    console.log("Không chạy seed/reshape khi deploy (chỉ prisma generate + next build).");

    if (prod && mockPhones > 0) {
      console.log(
        "\nGhi chú: Có user mock — đó là dữ liệu đã seed trước đó, không tự tạo lại khi deploy."
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
