import { InvoiceStatus, ReadingStatus } from "@/lib/types/enums";
import type { BillingSheetRow } from "./billingSheet";

/** Bộ lọc tab trên bảng thu. */
export type BillingSheetStatusFilter =
  | "all"
  | "pending"
  | "confirmed"
  | "unpaid"
  | "paid";

const VALID: BillingSheetStatusFilter[] = [
  "all",
  "pending",
  "confirmed",
  "unpaid",
  "paid",
];

export function parseBillingSheetStatusFilter(
  param: string | undefined
): BillingSheetStatusFilter {
  if (param && VALID.includes(param as BillingSheetStatusFilter)) {
    return param as BillingSheetStatusFilter;
  }
  return "all";
}

export function matchesBillingSheetStatusFilter(
  row: Pick<BillingSheetRow, "status" | "invoiceStatus" | "paid">,
  filter: BillingSheetStatusFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "paid") return row.paid;
  if (filter === "unpaid") {
    return Boolean(
      row.invoiceStatus &&
        row.invoiceStatus !== InvoiceStatus.PAID &&
        row.invoiceStatus !== InvoiceStatus.CANCELLED
    );
  }
  if (filter === "confirmed") return row.status === ReadingStatus.CONFIRMED;
  return row.status !== ReadingStatus.CONFIRMED;
}

export function countBillingSheetStatusFilter(
  rows: Pick<BillingSheetRow, "status" | "invoiceStatus" | "paid">[],
  filter: BillingSheetStatusFilter
): number {
  return rows.filter((r) => matchesBillingSheetStatusFilter(r, filter)).length;
}
