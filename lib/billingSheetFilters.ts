import { ReadingStatus } from "@/lib/types/enums";
import type { BillingSheetRow } from "./billingSheet";

/** Bộ lọc tab trên bảng thu — `pending` = chưa chốt CSM; `paid` = đã thu tiền (HĐ PAID). */
export type BillingSheetStatusFilter = "all" | "pending" | "confirmed" | "paid";

const VALID: BillingSheetStatusFilter[] = ["all", "pending", "confirmed", "paid"];

export function parseBillingSheetStatusFilter(
  param: string | undefined
): BillingSheetStatusFilter {
  if (param && VALID.includes(param as BillingSheetStatusFilter)) {
    return param as BillingSheetStatusFilter;
  }
  return "all";
}

export function matchesBillingSheetStatusFilter(
  row: Pick<BillingSheetRow, "status" | "paid">,
  filter: BillingSheetStatusFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "paid") return row.paid;
  if (filter === "confirmed") return row.status === ReadingStatus.CONFIRMED;
  return row.status !== ReadingStatus.CONFIRMED;
}

export function countBillingSheetStatusFilter(
  rows: Pick<BillingSheetRow, "status" | "paid">[],
  filter: BillingSheetStatusFilter
): number {
  return rows.filter((r) => matchesBillingSheetStatusFilter(r, filter)).length;
}
