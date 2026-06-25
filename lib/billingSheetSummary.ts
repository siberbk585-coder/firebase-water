import type { BillingSheetRow } from "./billingSheet";
import {
  countBillingSheetStatusFilter,
  matchesBillingSheetStatusFilter,
} from "./billingSheetFilters";
import { InvoiceStatus } from "./types/enums";
import { resolveInvoiceAmounts } from "./vat";

export type BillingSheetMoneySummary = {
  totalHouseholds: number;
  paidHouseholds: number;
  unpaidHouseholds: number;
  paidAmount: number;
  unpaidAmount: number;
};

function rowBillTotal(row: BillingSheetRow, vatPercent: number): number {
  if (row.totalAmount != null) return Math.round(row.totalAmount);
  const usage = row.usageM3 ?? 0;
  if (usage <= 0) return 0;
  const locked =
    row.paid ||
    row.invoiceStatus === InvoiceStatus.PAID ||
    row.invoiceStatus === InvoiceStatus.CANCELLED;
  if (!locked && row.invoiceStatus == null) return 0;
  return resolveInvoiceAmounts(
    {
      usageM3: usage,
      unitPrice: row.unitPrice,
      subtotalAmount: row.subtotalAmount,
      vatAmount: row.vatAmount,
      vatPercent: row.vatPercent,
      totalAmount: Math.round(usage * row.unitPrice),
    },
    row.vatPercent ?? vatPercent
  ).totalAmount;
}

export function summarizeBillingSheetMoney(
  rows: BillingSheetRow[],
  vatPercent: number
): BillingSheetMoneySummary {
  let paidAmount = 0;
  let unpaidAmount = 0;
  for (const row of rows) {
    const total = rowBillTotal(row, vatPercent);
    if (row.paid) paidAmount += total;
    else if (matchesBillingSheetStatusFilter(row, "unpaid")) unpaidAmount += total;
  }
  return {
    totalHouseholds: rows.length,
    paidHouseholds: countBillingSheetStatusFilter(rows, "paid"),
    unpaidHouseholds: countBillingSheetStatusFilter(rows, "unpaid"),
    paidAmount,
    unpaidAmount,
  };
}
