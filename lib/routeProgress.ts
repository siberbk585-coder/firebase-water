import { ReadingStatus } from "@/lib/types/enums";;
import { prisma } from "./db";
import { getBillingPeriods, getCollectionRoutes } from "./billingSheet";

export async function getCurrentPeriodProgress() {
  const periods = await getBillingPeriods();
  const current =
    periods.find((p) => p.status === "OPEN") ?? periods[0];
  if (!current) return null;

  const [totalActive, withReading, pending] = await Promise.all([
    prisma.household.count({ where: { status: "ACTIVE" } }),
    prisma.meterReading.count({
      where: {
        periodId: current.id,
        OR: [
          { confirmedValue: { not: null } },
          { ocrValue: { not: null } },
        ],
      },
    }),
    prisma.meterReading.count({
      where: { periodId: current.id, status: ReadingStatus.PENDING },
    }),
  ]);

  const routes = await getCollectionRoutes();
  const routeProgress = await Promise.all(
    routes.map(async (route) => {
      const total = await prisma.household.count({
        where: { status: "ACTIVE", collectionRouteId: route.id },
      });
      const recorded = await prisma.meterReading.count({
        where: {
          periodId: current.id,
          household: { collectionRouteId: route.id },
          confirmedValue: { not: null },
        },
      });
      return {
        routeId: route.id,
        routeName: route.name,
        total,
        recorded,
        missing: Math.max(0, total - recorded),
      };
    })
  );

  const percent = totalActive > 0 ? Math.round((withReading / totalActive) * 100) : 0;

  return {
    period: current,
    totalActive,
    withReading,
    pending,
    percent,
    routeProgress,
  };
}
