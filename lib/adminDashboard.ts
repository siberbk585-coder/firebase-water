import { ReadingStatus, InvoiceStatus } from "@/lib/types/enums";
import { prisma } from "@/lib/db";
import { getCurrentPeriodProgress } from "./routeProgress";
import { formatPeriod } from "./vi";
import { excludeSandboxHouseholdWhere } from "./sandboxRoutes";

type UsagePeriod = {
  id: string;
  year: number;
  month: number;
};

type MonthlyUsageRow = {
  periodId: string;
  label: string;
  totalM3: number;
  confirmedCount: number;
  averageM3: number;
  totalChangePercent: number | null;
  averageChangePercent: number | null;
  risk: "high" | "watch" | "normal";
};

type RouteLeakAlert = {
  routeId: string | null;
  routeName: string;
  currentTotalM3: number;
  previousTotalM3: number;
  currentAverageM3: number;
  previousAverageM3: number;
  totalChangePercent: number;
  averageChangePercent: number;
};

type MonthlyWaterUsage = {
  current: MonthlyUsageRow | null;
  previous: MonthlyUsageRow | null;
  rows: MonthlyUsageRow[];
  maxTotalM3: number;
  routeAlerts: RouteLeakAlert[];
};

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function classifyUsageRisk({
  currentTotal,
  previousTotal,
  currentCount,
  previousCount,
  totalChangePercent,
  averageChangePercent,
}: {
  currentTotal: number;
  previousTotal: number;
  currentCount: number;
  previousCount: number;
  totalChangePercent: number | null;
  averageChangePercent: number | null;
}): MonthlyUsageRow["risk"] {
  if (totalChangePercent == null) return "normal";
  const countRatio = previousCount > 0 ? currentCount / previousCount : 1;
  const totalIncrease = currentTotal - previousTotal;
  if (countRatio < 0.75) return "normal";
  if (
    totalIncrease >= 50 &&
    (totalChangePercent >= 30 || (averageChangePercent ?? 0) >= 30)
  ) {
    return "high";
  }
  if (
    totalIncrease >= 30 &&
    (totalChangePercent >= 15 || (averageChangePercent ?? 0) >= 15)
  ) {
    return "watch";
  }
  return "normal";
}

async function loadRouteLeakAlerts({
  currentPeriodId,
  previousPeriodId,
}: {
  currentPeriodId: string;
  previousPeriodId: string;
}): Promise<RouteLeakAlert[]> {
  const readings = await prisma.meterReading.findMany({
    where: {
      periodId: { in: [currentPeriodId, previousPeriodId] },
      status: ReadingStatus.CONFIRMED,
      usageM3: { not: null },
      household: excludeSandboxHouseholdWhere(),
    },
    select: {
      periodId: true,
      usageM3: true,
      household: {
        select: {
          collectionRouteId: true,
          collectionRoute: { select: { name: true } },
        },
      },
    },
  });

  const buckets = new Map<
    string,
    {
      routeId: string | null;
      routeName: string;
      currentTotalM3: number;
      previousTotalM3: number;
      currentCount: number;
      previousCount: number;
    }
  >();

  for (const reading of readings) {
    const routeId = reading.household.collectionRouteId;
    const key = routeId ?? "unassigned";
    const bucket =
      buckets.get(key) ??
      {
        routeId,
        routeName: reading.household.collectionRoute?.name ?? "Chưa gán khu vực",
        currentTotalM3: 0,
        previousTotalM3: 0,
        currentCount: 0,
        previousCount: 0,
      };

    if (reading.periodId === currentPeriodId) {
      bucket.currentTotalM3 += reading.usageM3 ?? 0;
      bucket.currentCount++;
    } else {
      bucket.previousTotalM3 += reading.usageM3 ?? 0;
      bucket.previousCount++;
    }

    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .map((bucket) => {
      const currentAverageM3 =
        bucket.currentCount > 0 ? bucket.currentTotalM3 / bucket.currentCount : 0;
      const previousAverageM3 =
        bucket.previousCount > 0 ? bucket.previousTotalM3 / bucket.previousCount : 0;
      return {
        routeId: bucket.routeId,
        routeName: bucket.routeName,
        currentTotalM3: bucket.currentTotalM3,
        previousTotalM3: bucket.previousTotalM3,
        currentAverageM3,
        previousAverageM3,
        totalChangePercent: percentChange(bucket.currentTotalM3, bucket.previousTotalM3) ?? 0,
        averageChangePercent: percentChange(currentAverageM3, previousAverageM3) ?? 0,
        countRatio:
          bucket.previousCount > 0 ? bucket.currentCount / bucket.previousCount : 1,
      };
    })
    .filter((route) => {
      const totalIncrease = route.currentTotalM3 - route.previousTotalM3;
      return (
        route.countRatio >= 0.75 &&
        totalIncrease >= 20 &&
        (route.totalChangePercent >= 25 || route.averageChangePercent >= 25)
      );
    })
    .sort((a, b) => b.totalChangePercent - a.totalChangePercent)
    .slice(0, 5)
    .map((route) => ({
      routeId: route.routeId,
      routeName: route.routeName,
      currentTotalM3: route.currentTotalM3,
      previousTotalM3: route.previousTotalM3,
      currentAverageM3: route.currentAverageM3,
      previousAverageM3: route.previousAverageM3,
      totalChangePercent: route.totalChangePercent,
      averageChangePercent: route.averageChangePercent,
    }));
}

async function loadMonthlyWaterUsage(
  activePeriod: UsagePeriod,
  allPeriods?: { id: string; year: number; month: number }[]
): Promise<MonthlyWaterUsage> {
  const periods = allPeriods
    ? [...allPeriods]
        .sort((a, b) => b.year - a.year || b.month - a.month)
        .slice(0, 12)
        .reverse()
    : (
        await prisma.billingPeriod.findMany({
          orderBy: [{ year: "desc" }, { month: "desc" }],
          take: 12,
          select: { id: true, year: true, month: true },
        })
      ).reverse();

  const periodIds = periods.map((p) => p.id);
  const usageGroups = periodIds.length
    ? await prisma.meterReading.groupBy({
        by: ["periodId"],
        where: {
          periodId: { in: periodIds },
          status: ReadingStatus.CONFIRMED,
          usageM3: { not: null },
        },
        _sum: { usageM3: true },
        _count: { id: true },
      })
    : [];

  const usageByPeriod = new Map(
    usageGroups.map((g) => [
      g.periodId,
      {
        totalM3: g._sum.usageM3 ?? 0,
        confirmedCount: g._count.id,
      },
    ])
  );

  const rows: MonthlyUsageRow[] = [];
  for (const period of periods) {
    const usage = usageByPeriod.get(period.id) ?? { totalM3: 0, confirmedCount: 0 };
    const previous = rows.at(-1);
    const averageM3 =
      usage.confirmedCount > 0 ? usage.totalM3 / usage.confirmedCount : 0;
    const totalChangePercent = previous
      ? percentChange(usage.totalM3, previous.totalM3)
      : null;
    const averageChangePercent = previous
      ? percentChange(averageM3, previous.averageM3)
      : null;

    rows.push({
      periodId: period.id,
      label: `T${period.month}/${period.year}`,
      totalM3: usage.totalM3,
      confirmedCount: usage.confirmedCount,
      averageM3,
      totalChangePercent,
      averageChangePercent,
      risk: classifyUsageRisk({
        currentTotal: usage.totalM3,
        previousTotal: previous?.totalM3 ?? 0,
        currentCount: usage.confirmedCount,
        previousCount: previous?.confirmedCount ?? 0,
        totalChangePercent,
        averageChangePercent,
      }),
    });
  }

  const current = rows.find((r) => r.periodId === activePeriod.id) ?? rows.at(-1) ?? null;
  const previous = current
    ? rows.slice(0, rows.findIndex((r) => r.periodId === current.periodId)).at(-1) ?? null
    : null;

  const routeAlerts =
    current && previous
      ? await loadRouteLeakAlerts({
          currentPeriodId: current.periodId,
          previousPeriodId: previous.periodId,
        })
      : [];

  return {
    current,
    previous,
    rows,
    maxTotalM3: Math.max(1, ...rows.map((r) => r.totalM3)),
    routeAlerts,
  };
}

export async function getAdminDashboard(periodId?: string) {
  const progress = await getCurrentPeriodProgress(periodId);
  if (!progress) {
    return null;
  }

  const { period, allPeriods, totalActive, withReading, pending, percent, routeProgress } =
    progress;

  const [invoiceByStatus, missingPdf, confirmedCount] = await Promise.all([
    prisma.invoice.groupBy({
      by: ["status"],
      where: { periodId: period.id, household: excludeSandboxHouseholdWhere() },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.invoice.count({
      where: {
        periodId: period.id,
        pdfPath: null,
        household: excludeSandboxHouseholdWhere(),
      },
    }),
    prisma.meterReading.count({
      where: {
        periodId: period.id,
        status: ReadingStatus.CONFIRMED,
        household: excludeSandboxHouseholdWhere(),
      },
    }),
  ]);

  const invoiceCount = invoiceByStatus.reduce((n, r) => n + r._count._all, 0);
  const paidInvoices =
    invoiceByStatus.find((r) => r.status === InvoiceStatus.PAID)?._count._all ?? 0;
  const paidAmount =
    invoiceByStatus.find((r) => r.status === InvoiceStatus.PAID)?._sum.totalAmount ?? 0;
  const unpaidAmount =
    invoiceByStatus.find((r) => r.status === InvoiceStatus.ISSUED)?._sum.totalAmount ?? 0;
  const unpaidInvoices =
    invoiceByStatus.find((r) => r.status === InvoiceStatus.ISSUED)?._count._all ?? 0;
  const missingReadings = Math.max(0, totalActive - withReading);

  const waterUsage = await loadMonthlyWaterUsage(period, allPeriods);

  return {
    period: {
      id: period.id,
      year: period.year,
      month: period.month,
      status: period.status,
      label: formatPeriod(period.month, period.year),
    },
    periods: allPeriods.map((p) => ({
      id: p.id,
      year: p.year,
      month: p.month,
      status: p.status,
      label: formatPeriod(p.month, p.year),
    })),
    progress: {
      totalActive,
      withReading,
      pending,
      percent,
      missingReadings,
      routeProgress: routeProgress.map((r) => ({
        routeId: r.routeId,
        routeName: r.routeName,
        total: r.total,
        recorded: r.recorded,
        missing: r.missing,
        invoicedAmount: r.invoicedAmount,
        paidAmount: r.paidAmount,
        unpaidAmount: r.unpaidAmount,
        percent: r.total > 0 ? Math.round((r.recorded / r.total) * 100) : 0,
      })),
    },
    invoices: {
      total: invoiceCount,
      paid: paidInvoices,
      unpaid: unpaidInvoices,
      missingPdf,
      paidAmount,
      unpaidAmount,
      confirmedCount,
    },
    waterUsage,
  };
}
