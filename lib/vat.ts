/**
 * Thuế VAT — hàm thuần (dùng được cả client, không import Prisma).
 *
 * Nghiệp vụ: **Giá** (m³ × đơn giá) + **Thuế GTGT** = **Thành tiền** (số phải thu).
 */

export type BillingAmounts = {
  /** Giá — tiền nước trước thuế (m³ × đơn giá, làm tròn VNĐ). */
  subtotal: number;
  vatPercent: number;
  vatAmount: number;
  /** Thành tiền = Giá + Thuế GTGT. */
  totalAmount: number;
};

export function normalizeVatPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value * 100) / 100;
}

export function calculateBillingAmounts(
  usageM3: number,
  unitPrice: number,
  vatPercent: number
): BillingAmounts {
  const subtotal = Math.round(usageM3 * unitPrice);
  const rate = normalizeVatPercent(vatPercent);
  const vatAmount = rate > 0 ? Math.round((subtotal * rate) / 100) : 0;
  return {
    subtotal,
    vatPercent: rate,
    vatAmount,
    totalAmount: subtotal + vatAmount,
  };
}

/** Hóa đơn migrate trước VAT: có Giá nhưng chưa cộng GTGT (vat=0, tổng = giá). */
export function invoiceNeedsVatBackfill(
  invoice: {
    subtotalAmount: number;
    vatAmount: number;
    totalAmount: number;
  },
  currentVatPercent: number
): boolean {
  if (normalizeVatPercent(currentVatPercent) <= 0) return false;
  const subtotal = Math.round(invoice.subtotalAmount);
  const total = Math.round(invoice.totalAmount);
  return Math.round(invoice.vatAmount) === 0 && total === subtotal;
}

/** Cộng GTGT lên Giá đã có (giữ nguyên tiền trước thuế). */
export function applyVatToSubtotal(
  subtotal: number,
  vatPercent: number
): BillingAmounts {
  const sub = Math.round(subtotal);
  const rate = normalizeVatPercent(vatPercent);
  const vatAmount = rate > 0 ? Math.round((sub * rate) / 100) : 0;
  return {
    subtotal: sub,
    vatPercent: rate,
    vatAmount,
    totalAmount: sub + vatAmount,
  };
}

/** Đọc số tiền hóa đơn (tương thích bản ghi cũ thiếu VAT). */
export function resolveInvoiceAmounts(
  invoice: {
    usageM3: number;
    unitPrice: number;
    subtotalAmount?: number | null;
    vatPercent?: number | null;
    vatAmount?: number | null;
    totalAmount: number;
  },
  currentVatPercent?: number
): BillingAmounts {
  if (invoice.subtotalAmount != null) {
    const subtotal = Math.round(invoice.subtotalAmount);
    const rate = normalizeVatPercent(currentVatPercent ?? invoice.vatPercent ?? 0);
    if (
      currentVatPercent != null &&
      invoiceNeedsVatBackfill(
        {
          subtotalAmount: subtotal,
          vatAmount: invoice.vatAmount ?? 0,
          totalAmount: invoice.totalAmount,
        },
        rate
      )
    ) {
      return applyVatToSubtotal(subtotal, rate);
    }
    const vatPercent = normalizeVatPercent(invoice.vatPercent ?? 0);
    const vatAmount = Math.round(invoice.vatAmount ?? 0);
    return {
      subtotal,
      vatPercent,
      vatAmount,
      totalAmount: Math.round(invoice.totalAmount),
    };
  }
  if (currentVatPercent != null && currentVatPercent > 0) {
    return calculateBillingAmounts(
      invoice.usageM3,
      invoice.unitPrice,
      currentVatPercent
    );
  }
  const subtotal = Math.round(invoice.totalAmount);
  return {
    subtotal,
    vatPercent: 0,
    vatAmount: 0,
    totalAmount: subtotal,
  };
}
