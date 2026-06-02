/**
 * Đánh dấu PAID + payment cho hóa đơn kỳ (giữ nguyên số tiền DB, VAT 0%).
 *
 *   npm run db:mark-period-paid -- --year 2026 --month 5 --dry-run
 *   ALLOW_DESTRUCTIVE_DB=yes-I-know npm run db:mark-period-paid -- --year 2026 --month 5
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
  assertDestructiveAllowed("db:mark-period-paid");
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

    const admin = await prisma.user.findFirst({
      where: { phone: "admin" },
      select: { id: true },
    });
    if (!admin) {
      console.error('Không tìm thấy user "admin"');
      process.exit(1);
    }

    const issued = await prisma.invoice.count({
      where: { periodId: period.id, status: "ISSUED" },
    });
    console.log(
      dryRun ? "[dry-run] " : "",
      `T${month}/${year}: ${issued} hóa đơn ISSUED → PAID (giữ nguyên total_amount, vat=0)`
    );
    if (issued === 0) {
      const paid = await prisma.invoice.count({
        where: { periodId: period.id, status: "PAID" },
      });
      console.log(`Không còn ISSUED. Đã PAID: ${paid}`);
      return;
    }

    if (dryRun) return;

    const client = new pg.Client({ connectionString: dbUrl });
    await client.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query(
        `UPDATE invoice SET status = 'PAID', updated_at = now()
         WHERE period_id = $1 AND status = 'ISSUED'`,
        [period.id]
      );
      await client.query(
        `INSERT INTO payment (id, invoice_id, amount, method, note, confirmed_at, confirmed_by_id)
         SELECT gen_random_uuid(), i.id, i.total_amount, h.payment_method,
                'Import T5/2026 — đã thu theo sổ gốc', now(), $2::uuid
         FROM invoice i
         JOIN household h ON h.id = i.household_id
         WHERE i.period_id = $1 AND i.status = 'PAID'
           AND NOT EXISTS (SELECT 1 FROM payment p WHERE p.invoice_id = i.id)`,
        [period.id, admin.id]
      );
      await client.query("COMMIT");
      console.log(`✓ Cập nhật ${updated.rowCount} hóa đơn`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      await client.end();
    }

    const paid = await prisma.invoice.count({
      where: { periodId: period.id, status: "PAID" },
    });
    const payments = await prisma.payment.count({
      where: { invoice: { periodId: period.id } },
    });
    console.log(`Tổng PAID: ${paid} | payment: ${payments}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
