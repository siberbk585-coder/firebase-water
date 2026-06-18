/**
 * Hoàn tác GTGT trên hóa đơn PAID một kỳ: total = Giá (subtotal), vat = 0.
 * Dùng sau import / đánh dấu PAID theo file gốc (không cộng VAT 10%).
 *
 *   npm run db:revert-period-vat -- --year 2026 --month 5 --dry-run
 *   ALLOW_DESTRUCTIVE_DB=yes-I-know npm run db:revert-period-vat -- --year 2026 --month 5
 */
import pg from "pg";
import { createPrismaTiennuoc } from "./prisma-tiennuoc";
import { assertDestructiveAllowed } from "../lib/destructiveDbGuard";

const dryRun = process.argv.includes("--dry-run");

function argNum(name: string, fallback: number): number {
  const i = process.argv.indexOf(name);
  if (i < 0 || !process.argv[i + 1]) return fallback;
  return parseInt(process.argv[i + 1], 10);
}

if (!dryRun) {
  assertDestructiveAllowed("db:revert-period-vat");
}

async function main() {
  const year = argNum("--year", 2026);
  const month = argNum("--month", 5);
  const prisma = await createPrismaTiennuoc();
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error("Thiếu DATABASE_URL");
    process.exit(1);
  }

  try {
    const period = await prisma.billingPeriod.findUnique({
      where: { year_month: { year, month } },
    });
    if (!period) {
      console.error(`Không có kỳ T${month}/${year}`);
      process.exit(1);
    }

    const needsRevert = await prisma.invoice.findMany({
      where: {
        periodId: period.id,
        status: "PAID",
        vatAmount: { gt: 0 },
      },
      select: {
        id: true,
        subtotalAmount: true,
        vatAmount: true,
        totalAmount: true,
        household: { select: { householdCode: true } },
        payment: { select: { id: true, amount: true } },
      },
      take: 5,
    });

    const [toFix, allPaid] = await Promise.all([
      prisma.$queryRaw<
        { n: bigint; vat_sum: number; sub_sum: number; tot_sum: number }[]
      >`
        SELECT
          COUNT(*)::bigint AS n,
          COALESCE(SUM(vat_amount), 0)::float AS vat_sum,
          COALESCE(SUM(subtotal_amount), 0)::float AS sub_sum,
          COALESCE(SUM(total_amount), 0)::float AS tot_sum
        FROM invoice
        WHERE period_id = ${period.id}::uuid
          AND status = 'PAID'
          AND (vat_amount > 0 OR ROUND(total_amount) <> ROUND(subtotal_amount))
      `,
      prisma.$queryRaw<{ tot_sum: number; sub_sum: number; vat_sum: number }[]>`
        SELECT
          COALESCE(SUM(total_amount), 0)::float AS tot_sum,
          COALESCE(SUM(subtotal_amount), 0)::float AS sub_sum,
          COALESCE(SUM(vat_amount), 0)::float AS vat_sum
        FROM invoice
        WHERE period_id = ${period.id}::uuid AND status = 'PAID'
      `,
    ]);

    const row = toFix[0];
    const count = Number(row?.n ?? 0);
    if (count === 0) {
      console.log(`T${month}/${year}: không có HĐ PAID cần hoàn tác GTGT.`);
      return;
    }

    const paidNow = allPaid[0];
    const paidTotalNow = Math.round(paidNow?.tot_sum ?? 0);
    const paidTotalAfter = Math.round(paidNow?.sub_sum ?? 0);

    console.log(
      dryRun ? "[dry-run] " : "",
      `T${month}/${year}: ${count} HĐ PAID — hoàn tác GTGT (total → subtotal)`
    );
    console.log(
      `  Cả kỳ — total hiện: ${paidTotalNow.toLocaleString("vi-VN")} · sau: ${paidTotalAfter.toLocaleString("vi-VN")} (bỏ GTGT ${Math.round(row.vat_sum).toLocaleString("vi-VN")} trên ${count} HĐ)`
    );
    if (needsRevert.length) {
      console.log("Ví dụ:");
      for (const inv of needsRevert) {
        console.log(
          ` • ${inv.household.householdCode}: ${inv.totalAmount} → ${inv.subtotalAmount} (bỏ GTGT ${inv.vatAmount})`
        );
      }
    }

    if (dryRun) return;

    const client = new pg.Client({ connectionString: dbUrl });
    await client.connect();
    try {
      await client.query("BEGIN");
      const invRes = await client.query(
        `UPDATE invoice
         SET vat_percent = 0,
             vat_amount = 0,
             total_amount = subtotal_amount,
             updated_at = now()
         WHERE period_id = $1::uuid
           AND status = 'PAID'
           AND (vat_amount > 0 OR ROUND(total_amount) <> ROUND(subtotal_amount))`,
        [period.id]
      );
      const payRes = await client.query(
        `UPDATE payment p
         SET amount = i.subtotal_amount
         FROM invoice i
         WHERE p.invoice_id = i.id
           AND i.period_id = $1::uuid
           AND i.status = 'PAID'
           AND ROUND(p.amount) <> ROUND(i.subtotal_amount)`,
        [period.id]
      );
      await client.query("COMMIT");
      console.log(`✓ Hóa đơn: ${invRes.rowCount} | payment: ${payRes.rowCount}`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      await client.end();
    }

    const after = await prisma.invoice.aggregate({
      where: { periodId: period.id, status: "PAID" },
      _sum: { subtotalAmount: true, vatAmount: true, totalAmount: true },
      _count: true,
    });
    console.log(
      `Tổng PAID: ${after._count} · subtotal/total ${Math.round(after._sum.subtotalAmount ?? 0).toLocaleString("vi-VN")} · vat ${Math.round(after._sum.vatAmount ?? 0)}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
