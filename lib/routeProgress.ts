import { ReadingStatus } from "@/lib/types/enums";
import { prisma } from "./db";
import {
  currentCalendarPeriod,
  getBillingPeriods,
  getCollectionRoutes,
} from "./billingSheet";
import { householdBillableWhere } from "./householdBillable";

type RouteCountRow = { collectionRouteId: string; count: bigint };

function pickDefaultPeriod(
  periods: Awaited<ReturnType<typeof getBillingPeriods>>,
  periodId?: string
) {
  if (periodId) {
    return (
      periods.find((p) => p.id === periodId) ??
      periods.find((p) => p.status === "OPEN") ??
      periods[0]
    );
  }
  const cal = currentCalendarPeriod();
  return (
    periods.find((p) => p.year === cal.year && p.month === cal.month) ??
    periods.find((p) => p.status === "OPEN") ??
    periods[0]
  );
}

export async function getCurrentPeriodProgress(periodId?: string) {
  const periods = await getBillingPeriods();
  const current = pickDefaultPeriod(periods, periodId);
  if (!current) return null;

  const routes = await getCollectionRoutes();

  // Tuần tự — tránh mở nhiều kết nối cùng lúc (pool max: 1 trên App Hosting)
  const billableWhere = householdBillableWhere(current.year, current.month);
  const totalActive = await prisma.household.count({ where: billableWhere });
  const withReading = await prisma.meterReading.count({
    where: {
      periodId: current.id,
      household: billableWhere,
      status: { in: [ReadingStatus.PENDING, ReadingStatus.CONFIRMED] },
      OR: [{ confirmedValue: { not: null } }, { ocrValue: { not: null } }],
    },
  });
  const pending = await prisma.meterReading.count({
    where: { periodId: current.id, status: ReadingStatus.PENDING },
  });
  const householdByRoute = await prisma.household.groupBy({
    by: ["collectionRouteId"],
    where: { ...billableWhere, collectionRouteId: { not: null } },
    _count: { _all: true },
  });
  const recordedByRoute = await prisma.$queryRaw<RouteCountRow[]>`
    SELECT h.collection_route_id AS "collectionRouteId", COUNT(*)::bigint AS count
    FROM meter_reading mr
    INNER JOIN household h ON h.id = mr.household_id
    WHERE mr.period_id = ${current.id}::uuid
      AND h.collection_route_id IS NOT NULL
      AND mr.confirmed_value IS NOT NULL
      AND mr.status IN ('PENDING'::reading_status, 'CONFIRMED'::reading_status)
      AND (
        h.status = 'ACTIVE'::household_status
        OR (
          h.status = 'INACTIVE'::household_status
          AND h.inactive_from_year IS NOT NULL
          AND h.inactive_from_month IS NOT NULL
          AND (
            h.inactive_from_year > ${current.year}
            OR (h.inactive_from_year = ${current.year} AND h.inactive_from_month >= ${current.month})
          )
        )
      )
    GROUP BY h.collection_route_id
  `;

  const totalByRoute = new Map(
    householdByRoute.map((r) => [r.collectionRouteId!, r._count._all])
  );
  const recordedMap = new Map(
    recordedByRoute.map((r) => [r.collectionRouteId, Number(r.count)])
  );

  const routeProgress = routes.map((route) => {
    const total = totalByRoute.get(route.id) ?? 0;
    const recorded = recordedMap.get(route.id) ?? 0;
    return {
      routeId: route.id,
      routeName: route.name,
      total,
      recorded,
      missing: Math.max(0, total - recorded),
    };
  });

  const percent = totalActive > 0 ? Math.round((withReading / totalActive) * 100) : 0;

  return {
    period: current,
    allPeriods: periods,
    totalActive,
    withReading,
    pending,
    percent,
    routeProgress,
  };
}
