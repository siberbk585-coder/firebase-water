import { InvoiceStatus, ReadingStatus } from "@/lib/types/enums";;
import { calculateTotal } from "./billing";
import { prisma } from "./db";
import { unitPriceForHousehold } from "./routePricing";

export type SyncedInvoice = {
  id: string;
  usageM3: number;
  unitPrice: number;
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
    select: { id: true, status: true, unitPrice: true, totalAmount: true, usageM3: true },
  });
  if (existing?.status === InvoiceStatus.ISSUED || existing?.status === InvoiceStatus.PAID) {
    return {
      id: existing.id,
      usageM3: existing.usageM3,
      unitPrice: existing.unitPrice,
      totalAmount: existing.totalAmount,
      status: existing.status,
    };
  }

  const unitPrice = unitPriceForHousehold(reading.household);
  const totalAmount = calculateTotal(reading.usageM3, unitPrice);

  const invoice = await prisma.invoice.upsert({
    where: { householdId_periodId: { householdId, periodId } },
    create: {
      householdId,
      periodId,
      usageM3: reading.usageM3,
      unitPrice,
      totalAmount,
      status: InvoiceStatus.ISSUED,
      issuedAt: new Date(),
    },
    update: {
      usageM3: reading.usageM3,
      unitPrice,
      totalAmount,
      status: InvoiceStatus.ISSUED,
      issuedAt: new Date(),
    },
  });

  return {
    id: invoice.id,
    usageM3: invoice.usageM3,
    unitPrice: invoice.unitPrice,
    totalAmount: invoice.totalAmount,
    status: invoice.status,
  };
}
