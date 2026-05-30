import { InvoiceStatus, ReadingStatus } from "@/lib/types/enums";;
import { prisma } from "./db";
import { unitPriceForHousehold } from "./routePricing";
import {
  calculateBillingAmounts,
  invoiceNeedsVatBackfill,
  resolveInvoiceAmounts,
} from "./vat";
import { getVatPercent } from "./vatServer";

export type SyncedInvoice = {
  id: string;
  usageM3: number;
  unitPrice: number;
  subtotalAmount: number;
  vatPercent: number;
  vatAmount: number;
  totalAmount: number;
  status: InvoiceStatus;
};

/** Tạo/cập nhật hóa đơn + tổng tiền khi chỉ số đã chốt (CONFIRMED). */
export async function syncInvoiceForConfirmedReading(
  householdId: string,
  periodId: string
): Promise<SyncedInvoice | null> {
  const reading = await prisma.meterReading.findUnique({
    where: { householdId_periodId: { householdId, periodId } },
    include: { household: { include: { priceGroup: true, collectionRoute: true } } },
  });

  if (
    !reading ||
    reading.status !== ReadingStatus.CONFIRMED ||
    reading.confirmedValue == null ||
    reading.usageM3 == null
  ) {
    return null;
  }

  // Không cập nhật hóa đơn đã phát hành (ISSUED) hoặc đã thu (PAID)
  const existing = await prisma.invoice.findUnique({
    where: { householdId_periodId: { householdId, periodId } },
    select: {
      id: true,
      status: true,
      unitPrice: true,
      subtotalAmount: true,
      vatPercent: true,
      vatAmount: true,
      totalAmount: true,
      usageM3: true,
    },
  });
  const unitPrice = unitPriceForHousehold(reading.household);
  const vatPercent = await getVatPercent();

  if (
    existing?.status === InvoiceStatus.PAID ||
    existing?.status === InvoiceStatus.CANCELLED
  ) {
    return {
      id: existing.id,
      usageM3: existing.usageM3,
      unitPrice: existing.unitPrice,
      subtotalAmount: existing.subtotalAmount,
      vatPercent: existing.vatPercent,
      vatAmount: existing.vatAmount,
      totalAmount: existing.totalAmount,
      status: existing.status,
    };
  }

  const amounts =
    existing?.status === InvoiceStatus.ISSUED &&
    !invoiceNeedsVatBackfill(existing, vatPercent) &&
    existing.usageM3 === reading.usageM3 &&
    existing.unitPrice === unitPrice
      ? resolveInvoiceAmounts(existing, vatPercent)
      : calculateBillingAmounts(reading.usageM3, unitPrice, vatPercent);

  const invoice = await prisma.invoice.upsert({
    where: { householdId_periodId: { householdId, periodId } },
    create: {
      householdId,
      periodId,
      usageM3: reading.usageM3,
      unitPrice,
      subtotalAmount: amounts.subtotal,
      vatPercent: amounts.vatPercent,
      vatAmount: amounts.vatAmount,
      totalAmount: amounts.totalAmount,
      status: InvoiceStatus.ISSUED,
      issuedAt: new Date(),
    },
    update: {
      usageM3: reading.usageM3,
      unitPrice,
      subtotalAmount: amounts.subtotal,
      vatPercent: amounts.vatPercent,
      vatAmount: amounts.vatAmount,
      totalAmount: amounts.totalAmount,
      status: InvoiceStatus.ISSUED,
      issuedAt: new Date(),
    },
  });

  return {
    id: invoice.id,
    usageM3: invoice.usageM3,
    unitPrice: invoice.unitPrice,
    subtotalAmount: invoice.subtotalAmount,
    vatPercent: invoice.vatPercent,
    vatAmount: invoice.vatAmount,
    totalAmount: invoice.totalAmount,
    status: invoice.status,
  };
}
