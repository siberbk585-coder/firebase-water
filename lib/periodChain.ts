import { ReadingStatus } from "@/lib/types/enums";
import { prisma } from "./db";
import { formatPeriod } from "./vi";

/** Kỳ lịch ngay trước (T4 → T3 cùng năm, T1 → T12 năm trước). */
export function calendarPriorPeriod(year: number, month: number): {
  year: number;
  month: number;
} {
  if (month <= 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

/**
 * Chốt chỉ số kỳ hiện tại chỉ khi kỳ liền trước đã CONFIRMED.
 * Hóa đơn kỳ trước ISSUED/chưa thu vẫn cho phép (đã chốt số).
 */
export async function assertPriorPeriodReadingConfirmed(
  householdId: string,
  period: { year: number; month: number }
): Promise<void> {
  const prior = calendarPriorPeriod(period.year, period.month);
  const priorPeriod = await prisma.billingPeriod.findUnique({
    where: { year_month: { year: prior.year, month: prior.month } },
    select: { id: true, year: true, month: true },
  });
  if (!priorPeriod) return;

  const priorReading = await prisma.meterReading.findUnique({
    where: {
      householdId_periodId: { householdId, periodId: priorPeriod.id },
    },
    select: { status: true },
  });

  if (priorReading?.status === ReadingStatus.CONFIRMED) return;

  throw new Error(
    `Chưa chốt chỉ số ${formatPeriod(prior.month, prior.year)} — cần chốt kỳ trước mới được chốt ${formatPeriod(period.month, period.year)}.`
  );
}
