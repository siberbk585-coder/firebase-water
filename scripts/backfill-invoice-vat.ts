/**
 * Tách GTGT từ thành tiền đã gồm VAT (vat=0, total=subtotal) — không tăng thành tiền.
 * Không áp lên HĐ đã PAID (dùng db:apply-vat-inclusive cho toàn bộ kỳ).
 *
 *   npm run db:backfill-invoice-vat -- --dry-run
 *   ALLOW_DESTRUCTIVE_DB=yes-I-know npm run db:backfill-invoice-vat
 */
import { InvoiceStatus } from "@prisma/client";
import { createPrismaTiennuoc } from "./prisma-tiennuoc";
import { assertDestructiveAllowed } from "../lib/destructiveDbGuard";
import {
  invoiceNeedsVatBackfill,
  normalizeVatPercent,
  splitVatInclusiveTotal,
} from "../lib/vat";

const dryRun = process.argv.includes("--dry-run");

if (!dryRun) {
  assertDestructiveAllowed("db:backfill-invoice-vat");
}

async function main() {
  const prisma = await createPrismaTiennuoc();
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: { vatPercent: true },
    });
    const vatPercent = normalizeVatPercent(settings?.vatPercent ?? 5);
    if (vatPercent <= 0) {
      console.log("Thuế GTGT = 0% — không cần backfill.");
      return;
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        status: {
          notIn: [
            InvoiceStatus.DRAFT,
            InvoiceStatus.CANCELLED,
            InvoiceStatus.PAID,
          ],
        },
        vatAmount: 0,
      },
      select: {
        id: true,
        status: true,
        usageM3: true,
        unitPrice: true,
        subtotalAmount: true,
        totalAmount: true,
        vatPercent: true,
        vatAmount: true,
        household: { select: { householdCode: true } },
        period: { select: { month: true, year: true } },
        payment: { select: { id: true, amount: true } },
      },
    });

    let updated = 0;
    let skipped = 0;
    const samples: string[] = [];

    for (const inv of invoices) {
      if (!invoiceNeedsVatBackfill(inv, vatPercent)) {
        skipped++;
        continue;
      }

      const amounts = splitVatInclusiveTotal(inv.totalAmount, vatPercent);

      const label = `${inv.household.householdCode} T${inv.period.month}/${inv.period.year} ${inv.status}`;
      if (samples.length < 5) {
        samples.push(
          `${label}: total ${amounts.totalAmount} → Giá ${amounts.subtotal} + GTGT ${amounts.vatAmount}`
        );
      }

      if (!dryRun) {
        await prisma.$transaction(async (tx) => {
          await tx.invoice.update({
            where: { id: inv.id },
            data: {
              subtotalAmount: amounts.subtotal,
              vatPercent: amounts.vatPercent,
              vatAmount: amounts.vatAmount,
              totalAmount: amounts.totalAmount,
            },
          });
          if (
            inv.status === InvoiceStatus.PAID &&
            inv.payment &&
            inv.payment.amount !== amounts.totalAmount
          ) {
            await tx.payment.update({
              where: { id: inv.payment.id },
              data: { amount: amounts.totalAmount },
            });
          }
        });
      }
      updated++;
    }

    console.log(
      dryRun ? "[dry-run] " : "",
      `VAT ${vatPercent}% — kiểm tra ${invoices.length} HĐ vat=0`
    );
    console.log(`Cập nhật: ${updated} | Bỏ qua (không đủ điều kiện): ${skipped}`);
    if (samples.length) {
      console.log("Ví dụ:");
      samples.forEach((s) => console.log(" •", s));
    }

    if (!dryRun && updated > 0) {
      const remaining = await prisma.invoice.count({
        where: {
          status: { notIn: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED] },
          vatAmount: 0,
        },
      });
      console.log(`Còn vat_amount=0 (sau backfill): ${remaining}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
