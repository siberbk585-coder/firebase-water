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

function hasEnteredReading(reading: {
  confirmedValue: number | null;
  ocrValue: number | null;
  imagePath: string | null;
}): boolean {
  return (
    reading.confirmedValue != null ||
    reading.ocrValue != null ||
    Boolean(reading.imagePath)
  );
}

/**
 * Kỳ liền trước đã CONFIRMED thì cho phép.
 * Nếu kỳ liền trước trống/chưa ghi thì cho phép bỏ qua; kỳ hiện tại sẽ tính dồn
 * từ kỳ CONFIRMED gần nhất trước đó.
 * Chỉ chặn khi kỳ liền trước đã có dữ liệu nhập/chụp ảnh nhưng chưa được chốt.
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
    select: {
      status: true,
      confirmedValue: true,
      ocrValue: true,
      imagePath: true,
    },
  });

  if (priorReading?.status === ReadingStatus.CONFIRMED) return;
  if (!priorReading || !hasEnteredReading(priorReading)) return;

  const hasAnyEarlierReading = await prisma.meterReading.findFirst({
    where: {
      householdId,
      period: {
        OR: [
          { year: { lt: period.year } },
          { year: period.year, month: { lt: period.month } },
        ],
      },
    },
    select: { id: true },
  });
  if (!hasAnyEarlierReading) return;

  throw new Error(
    `Chưa chốt chỉ số ${formatPeriod(prior.month, prior.year)} — cần chốt kỳ trước mới được chốt ${formatPeriod(period.month, period.year)}.`
  );
}
