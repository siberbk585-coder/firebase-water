import type { Prisma } from "@prisma/client";
import { HouseholdStatus } from "@/lib/types/enums";

export type PeriodRef = { year: number; month: number };

export function comparePeriod(a: PeriodRef, b: PeriodRef): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

/** Kỳ `period` nằm trong hoặc trước kỳ `through` (theo lịch). */
export function isPeriodOnOrBefore(period: PeriodRef, through: PeriodRef): boolean {
  return comparePeriod(period, through) <= 0;
}

export type HouseholdBillableFields = {
  status: string;
  inactiveFromYear: number | null;
  inactiveFromMonth: number | null;
};

/**
 * Hộ ACTIVE luôn thu. Hộ INACTIVE chỉ còn trên bảng kê đến hết kỳ ngưng (inactiveFrom*).
 */
export function isHouseholdBillableInPeriod(
  household: HouseholdBillableFields,
  periodYear: number,
  periodMonth: number
): boolean {
  if (household.status === HouseholdStatus.ACTIVE) return true;
  if (household.status !== HouseholdStatus.INACTIVE) return false;
  const { inactiveFromYear: y, inactiveFromMonth: m } = household;
  if (y == null || m == null) return false;
  return isPeriodOnOrBefore({ year: periodYear, month: periodMonth }, { year: y, month: m });
}

/** Prisma filter: hộ cần hiện trên bảng thu của kỳ (year, month). */
export function householdBillableWhere(
  periodYear: number,
  periodMonth: number
): Prisma.HouseholdWhereInput {
  return {
    OR: [
      { status: HouseholdStatus.ACTIVE },
      {
        status: HouseholdStatus.INACTIVE,
        inactiveFromYear: { not: null },
        inactiveFromMonth: { not: null },
        OR: [
          { inactiveFromYear: { gt: periodYear } },
          {
            inactiveFromYear: periodYear,
            inactiveFromMonth: { gte: periodMonth },
          },
        ],
      },
    ],
  };
}
