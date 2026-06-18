import { InvoiceStatus, ReadingStatus } from "@/lib/types/enums";;
import { unitPriceForHousehold } from "./routePricing";
import { syncInvoiceForConfirmedReading } from "./invoices";
import { calculateBillingAmounts, resolveInvoiceAmounts } from "./vat";
import { getVatPercent } from "./vatServer";
import { prisma } from "./db";
import { generateInvoicePdf } from "./pdf";
import { buildTransferNote } from "./paymentQr";
import {
  n8nInvoiceWebhookUrl,
  postInvoicePdfToN8nWebhook,
} from "./n8nInvoicePdf";
import { saveBuffer } from "./storage";
import { getSession } from "./auth";
import { formatPeriod, paymentMethodLabel } from "./vi";

/** Đảm bảo có hóa đơn đã tính tổng tiền từ chỉ số đã chốt. */
export async function ensureInvoiceForHouseholdPeriod(
  householdId: string,
  periodId: string
): Promise<string> {
  const synced = await syncInvoiceForConfirmedReading(householdId, periodId);
  if (!synced) {
    throw new Error("Hộ chưa chốt số — chốt trên bảng trước");
  }
  return synced.id;
}

/** Tạo / cập nhật 1 hóa đơn PDF — ưu tiên lưu n8n, fallback local khi dev. */
export async function exportInvoicePdfLocal(invoiceId: string): Promise<{
  buffer: Buffer;
  pdfPath: string;
  meterCode: string;
}> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      household: { include: { priceGroup: true, collectionRoute: true } },
      period: true,
    },
  });
  if (!invoice) {
    throw new Error("Không tìm thấy hóa đơn");
  }

  const reading = await prisma.meterReading.findUnique({
    where: {
      householdId_periodId: {
        householdId: invoice.householdId,
        periodId: invoice.periodId,
      },
    },
  });

  if (!reading || reading.status !== ReadingStatus.CONFIRMED) {
    throw new Error("Hộ chưa chốt chỉ số (CSM) — chốt trên bảng ghi trước");
  }
  if (reading.confirmedValue == null || reading.usageM3 == null) {
    throw new Error("Thiếu chỉ số đã chốt");
  }

  const unitPrice =
    invoice.unitPrice ?? unitPriceForHousehold(invoice.household);
  const usageM3 = invoice.usageM3 ?? reading.usageM3;
  const vatPercent = await getVatPercent();
  const invoiceLocked =
    invoice.status === InvoiceStatus.PAID ||
    invoice.status === InvoiceStatus.CANCELLED;
  const amounts =
    invoice.subtotalAmount != null
      ? invoiceLocked
        ? resolveInvoiceAmounts(invoice)
        : resolveInvoiceAmounts(invoice, vatPercent)
      : calculateBillingAmounts(usageM3, unitPrice, vatPercent);
  const periodLabel = formatPeriod(invoice.period.month, invoice.period.year);
  const invoiceCode = `HD-${invoice.period.year}${String(invoice.period.month).padStart(2, "0")}-${invoice.household.householdCode}`;
  const session = await getSession();

  const pdf = await generateInvoicePdf({
    invoiceCode,
    householdCode: invoice.household.householdCode,
    meterCode: invoice.household.meterCode,
    residentName: invoice.household.residentName,
    address: invoice.household.address,
    periodLabel,
    periodMonth: invoice.period.month,
    periodYear: invoice.period.year,
    oldReading: reading.oldReading,
    newReading: reading.confirmedValue,
    usageM3,
    unitPrice,
    subtotalAmount: amounts.subtotal,
    vatAmount: amounts.vatAmount,
    vatPercent: amounts.vatPercent,
    totalAmount: amounts.totalAmount,
    paymentMethod: paymentMethodLabel(invoice.household.paymentMethod),
    transferNote: buildTransferNote(
      invoice.household.meterCode,
      invoice.period.month,
      invoice.period.year
    ),
    copyLabel: process.env.INVOICE_COPY_LABEL?.trim() || "2",
    contactPhones: process.env.INVOICE_CONTACT_PHONES?.trim(),
    collectorName: session?.name,
  });

  const filename = `${invoice.household.meterCode}_${invoice.period.year}-${invoice.period.month}.pdf`;
  let pdfPath: string | null = null;

  const shouldUploadToN8n =
    process.env.N8N_INVOICE_WEBHOOK_DISABLED !== "true" &&
    Boolean(process.env.N8N_INVOICE_WEBHOOK_URL?.trim());

  if (shouldUploadToN8n && n8nInvoiceWebhookUrl()) {
    try {
      const uploaded = await postInvoicePdfToN8nWebhook(pdf, {
        invoiceId: invoice.id,
        householdId: invoice.householdId,
        periodId: invoice.periodId,
        householdCode: invoice.household.householdCode,
        meterCode: invoice.household.meterCode,
        periodLabel,
        totalAmount: amounts.totalAmount,
      });
      pdfPath = uploaded.url;
    } catch (error) {
      console.warn("[invoicePdfLocal] n8n upload failed, fallback to local file", error);
    }
  }

  if (!pdfPath) {
    pdfPath = await saveBuffer("invoices", filename, pdf);
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      pdfPath,
      usageM3,
      unitPrice,
      subtotalAmount: amounts.subtotal,
      vatPercent: amounts.vatPercent,
      vatAmount: amounts.vatAmount,
      totalAmount: amounts.totalAmount,
      status: InvoiceStatus.ISSUED,
      issuedAt: invoice.issuedAt ?? new Date(),
    },
  });

  return {
    buffer: pdf,
    pdfPath,
    meterCode: invoice.household.meterCode,
  };
}
