import { ReadingStatus } from "@/lib/types/enums";
import { prisma } from "./db";
import { getBillingPeriods, getCollectionRoutes } from "./billingSheet";

type RouteCountRow = { collectionRouteId: string; count: bigint };

export async function getCurrentPeriodProgress(periodId?: string) {
  const periods = await getBillingPeriods();
  const current = periodId
    ? (periods.find((p) => p.id === periodId) ?? periods.find((p) => p.status === "OPEN") ?? periods[0])
    : (periods.find((p) => p.status === "OPEN") ?? periods[0]);
  if (!current) return null;

  const routes = await getCollectionRoutes();

  // Tuần tự — tránh mở nhiều kết nối cùng lúc (pool max: 1 trên App Hosting)
  const totalActive = await prisma.household.count({ where: { status: "ACTIVE" } });
  const withReading = await prisma.meterReading.count({
    where: {
      periodId: current.id,
      household: { status: "ACTIVE" },
      status: { in: [ReadingStatus.PENDING, ReadingStatus.CONFIRMED] },
      OR: [{ confirmedValue: { not: null } }, { ocrValue: { not: null } }],
    },
  });
  const pending = await prisma.meterReading.count({
    where: { periodId: current.id, status: ReadingStatus.PENDING },
  });
  const householdByRoute = await prisma.household.groupBy({
    by: ["collectionRouteId"],
    where: { status: "ACTIVE", collectionRouteId: { not: null } },
    _count: { _all: true },
  });
  const recordedByRoute = await prisma.$queryRaw<RouteCountRow[]>`
    SELECT h.collection_route_id AS "collectionRouteId", COUNT(*)::bigint AS count
    FROM meter_reading mr
    INNER JOIN household h ON h.id = mr.household_id
    WHERE mr.period_id = ${current.id}::uuid
      AND h.status = 'ACTIVE'::household_status
      AND h.collection_route_id IS NOT NULL
      AND mr.confirmed_value IS NOT NULL
      AND mr.status IN ('PENDING'::reading_status, 'CONFIRMED'::reading_status)
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
