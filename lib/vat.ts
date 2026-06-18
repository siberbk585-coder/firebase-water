/**
 * Thuế VAT — hàm thuần (dùng được cả client, không import Prisma).
 *
 * Nghiệp vụ HTX: **đơn giá (đ/m³) đã gồm VAT**. Thành tiền = m³ × đơn giá (làm tròn VNĐ).
 * Trên hóa đơn tách: **Giá** (trước thuế) + **Thuế GTGT** = **Thành tiền** (không đổi số phải thu).
 */

export type BillingAmounts = {
  /** Giá — tiền nước trước thuế (tách từ thành tiền đã gồm VAT). */
  subtotal: number;
  vatPercent: number;
  vatAmount: number;
  /** Thành tiền = m³ × đơn giá (đã gồm VAT khi rate > 0). */
  totalAmount: number;
};

export function normalizeVatPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value * 100) / 100;
}

/** Tách GTGT từ thành tiền đã gồm thuế (giữ nguyên total). */
export function splitVatInclusiveTotal(
  totalAmount: number,
  vatPercent: number
): BillingAmounts {
  const total = Math.round(totalAmount);
  const rate = normalizeVatPercent(vatPercent);
  if (rate <= 0 || total <= 0) {
    return { subtotal: total, vatPercent: 0, vatAmount: 0, totalAmount: total };
  }
  const subtotal = Math.round(total / (1 + rate / 100));
  const vatAmount = total - subtotal;
  return {
    subtotal,
    vatPercent: rate,
    vatAmount,
    totalAmount: total,
  };
}

/** Đơn giá trước thuế — tách ngược từ giá nhập đã gồm VAT (vd. 9.500 → ~9.048). */
export function unitPriceExclusiveFromInclusive(
  unitPriceInclusive: number,
  vatPercent: number
): number {
  const rate = normalizeVatPercent(vatPercent);
  const inclusive = Math.round(unitPriceInclusive);
  if (rate <= 0 || inclusive <= 0) return inclusive;
  return Math.round(inclusive / (1 + rate / 100));
}

/**
 * Đơn giá in trên hóa đơn (trước thuế/m³) — khớp cột Thành tiền dòng = SL × đơn giá.
 */
export function receiptUnitPriceDisplay(
  unitPriceInclusive: number,
  usageM3: number,
  subtotalAmount: number,
  vatPercent: number
): number {
  const usage = Math.round(usageM3);
  const subtotal = Math.round(subtotalAmount);
  if (usage > 0 && subtotal > 0) {
    return Math.round(subtotal / usage);
  }
  return unitPriceExclusiveFromInclusive(unitPriceInclusive, vatPercent);
}

/** m³ × đơn giá (đã gồm VAT) → tách Giá + GTGT. */
export function calculateBillingAmounts(
  usageM3: number,
  unitPrice: number,
  vatPercent: number
): BillingAmounts {
  const totalAmount = Math.round(usageM3 * unitPrice);
  return splitVatInclusiveTotal(totalAmount, vatPercent);
}

/** Hóa đơn chưa tách GTGT: vat=0 và tổng = số đang hiển thị (coi là đã gồm VAT). */
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

/** @deprecated Chỉ dùng khi cộng VAT kiểu cũ (giá chưa gồm thuế). */
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
  const total = Math.round(invoice.totalAmount);
  const rate = normalizeVatPercent(currentVatPercent ?? invoice.vatPercent ?? 0);

  if (invoice.subtotalAmount != null) {
    const subtotal = Math.round(invoice.subtotalAmount);
    const vatAmount = Math.round(invoice.vatAmount ?? 0);
    if (
      currentVatPercent != null &&
      invoiceNeedsVatBackfill(
        {
          subtotalAmount: subtotal,
          vatAmount,
          totalAmount: total,
        },
        rate
      )
    ) {
      return splitVatInclusiveTotal(total, rate);
    }
    const vatPercent = normalizeVatPercent(invoice.vatPercent ?? 0);
    return {
      subtotal,
      vatPercent,
      vatAmount,
      totalAmount: total,
    };
  }
  if (currentVatPercent != null && currentVatPercent > 0) {
    return calculateBillingAmounts(
      invoice.usageM3,
      invoice.unitPrice,
      currentVatPercent
    );
  }
  return {
    subtotal: total,
    vatPercent: 0,
    vatAmount: 0,
    totalAmount: total,
  };
}
