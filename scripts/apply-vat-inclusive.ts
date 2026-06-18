/**
 * Áp mô hình đơn giá đã gồm VAT: cập nhật % hệ thống + tách Giá/GTGT trên mọi hóa đơn.
 * Thành tiền (total_amount) và payment.amount không đổi.
 *
 *   npm run db:apply-vat-inclusive -- --dry-run
 *   npm run db:apply-vat-inclusive -- --vat 5
 *   ALLOW_DESTRUCTIVE_DB=yes-I-know npm run db:apply-vat-inclusive
 */
import { createPrismaTiennuoc } from "./prisma-tiennuoc";
import { assertDestructiveAllowed } from "../lib/destructiveDbGuard";
import { splitVatInclusiveTotal } from "../lib/vat";

const dryRun = process.argv.includes("--dry-run");

function argNum(name: string, fallback: number): number {
  const i = process.argv.indexOf(name);
  if (i < 0 || !process.argv[i + 1]) return fallback;
  return parseInt(process.argv[i + 1], 10);
}

if (!dryRun) {
  assertDestructiveAllowed("db:apply-vat-inclusive");
}

async function main() {
  const vatPercent = argNum("--vat", 5);
  const prisma = await createPrismaTiennuoc();

  try {
    const before = await prisma.invoice.aggregate({
      _count: true,
      _sum: { totalAmount: true, subtotalAmount: true, vatAmount: true },
    });
    const beforeTotal = Math.round(before._sum.totalAmount ?? 0);

    const invoices = await prisma.invoice.findMany({
      select: {
        id: true,
        totalAmount: true,
        subtotalAmount: true,
        vatAmount: true,
        vatPercent: true,
      },
    });

    let changed = 0;
    const samples: string[] = [];

    for (const inv of invoices) {
      const amounts = splitVatInclusiveTotal(inv.totalAmount, vatPercent);
      const same =
        Math.round(inv.subtotalAmount) === amounts.subtotal &&
        Math.round(inv.vatAmount) === amounts.vatAmount &&
        Math.round(inv.vatPercent) === amounts.vatPercent;
      if (same) continue;
      changed++;
      if (samples.length < 5) {
        samples.push(
          `  ${inv.id.slice(0, 8)}…: total ${inv.totalAmount} → Giá ${amounts.subtotal} + GTGT ${amounts.vatAmount} (${amounts.vatPercent}%)`
        );
      }
      if (!dryRun) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            subtotalAmount: amounts.subtotal,
            vatPercent: amounts.vatPercent,
            vatAmount: amounts.vatAmount,
            totalAmount: amounts.totalAmount,
          },
        });
      }
    }

    console.log(
      dryRun ? "[dry-run] " : "",
      `VAT ${vatPercent}% (đơn giá đã gồm thuế) — ${invoices.length} hóa đơn, cập nhật ${changed}`
    );
    if (samples.length) {
      console.log("Ví dụ:");
      samples.forEach((s) => console.log(s));
    }

    if (!dryRun) {
      await prisma.systemSettings.upsert({
        where: { id: "default" },
        create: { id: "default", vatPercent },
        update: { vatPercent },
      });
    } else {
      console.log(`Sẽ đặt system_settings.vat_percent = ${vatPercent}`);
    }

    const after = dryRun
      ? {
          _count: before._count,
          _sum: {
            totalAmount: beforeTotal,
            subtotalAmount: invoices.reduce(
              (s, inv) =>
                s + splitVatInclusiveTotal(inv.totalAmount, vatPercent).subtotal,
              0
            ),
            vatAmount: invoices.reduce(
              (s, inv) =>
                s + splitVatInclusiveTotal(inv.totalAmount, vatPercent).vatAmount,
              0
            ),
          },
        }
      : await prisma.invoice.aggregate({
          _count: true,
          _sum: { totalAmount: true, subtotalAmount: true, vatAmount: true },
        });

    const afterTotal = Math.round(after._sum.totalAmount ?? 0);
    console.log(
      `Tổng thành tiền: ${beforeTotal.toLocaleString("vi-VN")} → ${afterTotal.toLocaleString("vi-VN")} (${beforeTotal === afterTotal ? "không đổi" : "LỆCH!"})`
    );
    console.log(
      `Tổng Giá (subtotal): ${Math.round(after._sum.subtotalAmount ?? 0).toLocaleString("vi-VN")} · GTGT: ${Math.round(after._sum.vatAmount ?? 0).toLocaleString("vi-VN")}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
