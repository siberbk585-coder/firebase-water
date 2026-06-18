import { HouseholdStatus, PeriodStatus, ReadingStatus } from "@/lib/types/enums";
import { prisma } from "./db";
import { DEFAULT_OLD_READING_NO_PRIOR, getOldReading } from "./readings";

const OPERATING_TZ = "Asia/Ho_Chi_Minh";

/** Tháng/năm lịch theo múi giờ vận hành (vd. tháng 6 → { month: 6, year }). */
export function currentCalendarPeriod(now = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPERATING_TZ,
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return { year, month };
}

/** Tạo kỳ tháng hiện tại (OPEN) nếu chưa có; không đổi trạng thái kỳ đã CLOSED. */
export async function ensureCurrentBillingPeriod() {
  const { year, month } = currentCalendarPeriod();
  return ensureBillingPeriod(year, month);
}

export async function ensureBillingPeriod(year: number, month: number) {
  const existing = await prisma.billingPeriod.findUnique({
    where: { year_month: { year, month } },
  });

  const period = await prisma.billingPeriod.upsert({
    where: { year_month: { year, month } },
    create: { year, month, status: PeriodStatus.OPEN },
    update: {},
  });

  if (period.status === PeriodStatus.OPEN) {
    await ensureActiveHouseholdsInPeriod(period.id);
  }

  return { period, created: !existing };
}

/**
 * Mọi hộ ACTIVE phải có bản ghi chỉ số PENDING trong kỳ đang OPEN
 * (để hiện trên bảng thu và chốt CSM).
 */
export async function ensureActiveHouseholdsInPeriod(periodId: string): Promise<number> {
  const period = await prisma.billingPeriod.findUniqueOrThrow({
    where: { id: periodId },
    select: { id: true, year: true, month: true, status: true },
  });
  if (period.status !== PeriodStatus.OPEN) return 0;

  const households = await prisma.household.findMany({
    where: { status: HouseholdStatus.ACTIVE },
    select: { id: true, meterCode: true },
  });
  if (!households.length) return 0;

  const existing = await prisma.meterReading.findMany({
    where: { periodId },
    select: { householdId: true },
  });
  const enrolled = new Set(existing.map((r) => r.householdId));
  const missing = households.filter((h) => !enrolled.has(h.id));
  if (!missing.length) return 0;

  const priorReadings = await prisma.meterReading.findMany({
    where: {
      householdId: { in: missing.map((h) => h.id) },
      status: ReadingStatus.CONFIRMED,
      confirmedValue: { not: null },
      period: {
        OR: [
          { year: { lt: period.year } },
          { year: period.year, month: { lt: period.month } },
        ],
      },
    },
    select: {
      householdId: true,
      confirmedValue: true,
      period: { select: { year: true, month: true } },
    },
    orderBy: [
      { householdId: "asc" },
      { period: { year: "desc" } },
      { period: { month: "desc" } },
    ],
  });

  const cscByHousehold = new Map<string, number>();
  for (const r of priorReadings) {
    if (!cscByHousehold.has(r.householdId) && r.confirmedValue != null) {
      cscByHousehold.set(r.householdId, r.confirmedValue);
    }
  }

  await prisma.meterReading.createMany({
    data: missing.map((h) => ({
      householdId: h.id,
      periodId: period.id,
      oldReading: cscByHousehold.get(h.id) ?? DEFAULT_OLD_READING_NO_PRIOR,
      status: ReadingStatus.PENDING,
      anomalyFlags: "[]",
    })),
    skipDuplicates: true,
  });

  return missing.length;
}

/**
 * Gắn hộ mới vào kỳ thu đang mở của tháng hiện tại (không gắn các kỳ OPEN cũ — vd. T5 đã import).
 */
export async function enrollHouseholdInOpenPeriods(householdId: string): Promise<void> {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: { status: true },
  });
  if (!household || household.status !== HouseholdStatus.ACTIVE) return;

  const { year, month } = currentCalendarPeriod();
  const period =
    (await prisma.billingPeriod.findFirst({
      where: { status: PeriodStatus.OPEN, year, month },
      select: { id: true },
    })) ??
    (await prisma.billingPeriod.findFirst({
      where: { status: PeriodStatus.OPEN },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { id: true },
    }));
  if (!period) return;

  const exists = await prisma.meterReading.findUnique({
    where: {
      householdId_periodId: { householdId, periodId: period.id },
    },
    select: { id: true },
  });
  if (exists) return;

  const oldReading = await getOldReading(householdId, period.id);
  await prisma.meterReading.create({
    data: {
      householdId,
      periodId: period.id,
      oldReading,
      status: ReadingStatus.PENDING,
      anomalyFlags: "[]",
    },
  });
}
