import { calculateBillingAmounts } from "./vat";

export function calculateUsage(confirmed: number, oldReading: number): number {
  return Math.max(0, confirmed - oldReading);
}

export function calculateTotal(usageM3: number, unitPrice: number): number {
  return Math.round(usageM3 * unitPrice);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export type BillingPreview = {
  usageM3: number | null;
  subtotal: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
};

const EMPTY_PREVIEW: BillingPreview = {
  usageM3: null,
  subtotal: null,
  vatAmount: null,
  totalAmount: null,
};

export function previewBillingRow(
  oldReading: number,
  csm: number | null,
  unitPrice: number,
  vatPercent = 0
): BillingPreview {
  if (csm == null || Number.isNaN(csm)) {
    return EMPTY_PREVIEW;
  }
  const usageM3 = calculateUsage(csm, oldReading);
  if (usageM3 <= 0) {
    return { usageM3: 0, subtotal: 0, vatAmount: 0, totalAmount: 0 };
  }
  const amounts = calculateBillingAmounts(usageM3, unitPrice, vatPercent);
  return {
    usageM3,
    subtotal: amounts.subtotal,
    vatAmount: amounts.vatAmount,
    totalAmount: amounts.totalAmount,
  };
}

/** Ưu tiên số đã lưu trên hóa đơn; khi đang gõ CSM dùng preview. */
export function resolveBillingDisplay(
  row: {
    subtotalAmount: number | null;
    vatAmount: number | null;
    totalAmount: number | null;
  },
  preview: BillingPreview,
  usePreview: boolean
): BillingPreview {
  if (
    !usePreview &&
    row.subtotalAmount != null &&
    row.totalAmount != null
  ) {
    return {
      usageM3: preview.usageM3,
      subtotal: row.subtotalAmount,
      vatAmount: row.vatAmount ?? 0,
      totalAmount: row.totalAmount,
    };
  }
  return preview;
}

export function formatBillingAmountCell(amount: number | null): string {
  if (amount == null) return "—";
  return formatCurrency(amount);
}
