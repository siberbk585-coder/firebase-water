#!/usr/bin/env node
/**
 * Xóa dữ liệu mock/khách hàng cũ, nạp dữ liệu thật T5/2026 từ file SQL.
 *
 *   ALLOW_DESTRUCTIVE_DB=yes-I-know npm run db:import-real-water-data
 *   ALLOW_DESTRUCTIVE_DB=yes-I-know npm run db:import-real-water-data -- --sql path/to/custom.sql
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createPrismaTiennuoc } from "./prisma-tiennuoc.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_IMPORT_SQL = resolve(
  ROOT,
  "scripts/data/tiennuoc_t5_2026_seed_v2_audited.sql"
);

const PROD_MARKERS = ["tiennuoc_water", "cloudsql/tiennuoc", "tiennuoc-db"];

function assertAllowed() {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  const prod = PROD_MARKERS.some((m) => url.toLowerCase().includes(m));
  if (!prod) return;
  if (process.env.ALLOW_DESTRUCTIVE_DB !== "yes-I-know") {
    console.error(
      "[db-guard] Cần ALLOW_DESTRUCTIVE_DB=yes-I-know để purge + import trên production."
    );
    process.exit(1);
  }
  console.warn("[db-guard] ALLOW_DESTRUCTIVE_DB=yes-I-know — purge + import production.");
}

function sqlPathArg() {
  const i = process.argv.indexOf("--sql");
  if (i >= 0 && process.argv[i + 1]) return resolve(process.cwd(), process.argv[i + 1]);
  return DEFAULT_IMPORT_SQL;
}

function getDbUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("Thiếu DATABASE_URL (bật Cloud SQL proxy: port 5433).");
    process.exit(1);
  }
  return url;
}

async function counts(prisma) {
  const [h, r, i, p, u, mock] = await Promise.all([
    prisma.household.count(),
    prisma.meterReading.count(),
    prisma.invoice.count(),
    prisma.payment.count(),
    prisma.user.count(),
    prisma.user.count({ where: { phone: { startsWith: "0931000" } } }),
  ]);
  return { households: h, readings: r, invoices: i, payments: p, users: u, mockUsers: mock };
}

async function main() {
  assertAllowed();
  const importFile = sqlPathArg();
  if (!existsSync(importFile)) {
    console.error("Không tìm thấy file SQL:", importFile);
    process.exit(1);
  }

  const purgeFile = resolve(__dirname, "purge-customer-data.sql");
  const prisma = await createPrismaTiennuoc();
  const dbUrl = getDbUrl();
  const client = new pg.Client({ connectionString: dbUrl });

  try {
    console.log("=== Trước purge ===");
    console.log(await counts(prisma));

    const admin = await prisma.user.findUnique({ where: { phone: "admin" } });
    if (!admin) {
      console.error('Không tìm thấy user "admin" — dừng để tránh mất quản trị.');
      process.exit(1);
    }
    console.log(`Giữ tài khoản admin: ${admin.name}`);

    await client.connect();

    console.log("\n=== Purge dữ liệu khách hàng ===");
    await client.query(readFileSync(purgeFile, "utf8"));
    console.log("✓ Đã purge");

    console.log("\n=== Sau purge ===");
    console.log(await counts(prisma));

    console.log("\n=== Import dữ liệu thật (1 phiên DB) ===");
    console.log("File:", importFile);
    const importSql = readFileSync(importFile, "utf8");
    await client.query(importSql);
    console.log("✓ Import xong");

    console.log("\n=== Sau import ===");
    const after = await counts(prisma);
    console.log(after);

    const t5 = await prisma.billingPeriod.findFirst({
      where: { year: 2026, month: 5 },
      select: { id: true, status: true },
    });
    if (t5) {
      const [rd, inv, issued] = await Promise.all([
        prisma.meterReading.count({ where: { periodId: t5.id } }),
        prisma.invoice.count({ where: { periodId: t5.id } }),
        prisma.invoice.aggregate({
          where: { periodId: t5.id },
          _sum: { totalAmount: true },
        }),
      ]);
      console.log(
        `T5/2026 (${t5.status}): ${rd} chỉ số, ${inv} hóa đơn, tổng tiền ${issued._sum.totalAmount ?? 0} VNĐ`
      );
    }
    const routes = await prisma.collectionRoute.count();
    console.log(`Tuyến thu: ${routes}`);
  } finally {
    await client.end().catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
