import { NextResponse } from "next/server";
import {
  filterRoutesForSession,
  getCollectorRouteIds,
  isAdmin,
} from "@/lib/collectorAccess";
import {
  currentCalendarPeriod,
  getAssignedCollectionRoutes,
  getBillingPeriods,
  getCollectionRoutes,
} from "@/lib/billingSheet";
import {
  requireStaffSession,
  staffUnauthorized,
} from "@/lib/staffAuth";
import { formatPeriod } from "@/lib/vi";
import { getVatPercent } from "@/lib/vatServer";

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return staffUnauthorized();

  const [periods, vatPercent] = await Promise.all([
    getBillingPeriods(),
    getVatPercent(),
  ]);

  const allowedRouteIds = isAdmin(session)
    ? undefined
    : await getCollectorRouteIds(session.id);

  const allRoutes = isAdmin(session)
    ? await getCollectionRoutes()
    : await getAssignedCollectionRoutes(allowedRouteIds ?? []);

  const routes = isAdmin(session)
    ? allRoutes
    : filterRoutesForSession(session, allRoutes, allowedRouteIds ?? []);

  const routeAccess = isAdmin(session)
    ? "all"
    : !allowedRouteIds?.length
      ? "none"
      : "assigned";

  const cal = currentCalendarPeriod();
  const openPeriod =
    periods.find((p) => p.year === cal.year && p.month === cal.month) ??
    periods.find((p) => p.status === "OPEN") ??
    periods[0];

  return NextResponse.json({
    user: {
      id: session.id,
      name: session.name,
      phone: session.phone,
      role: session.role,
      username: session.username ?? null,
    },
    periods: periods.map((p) => ({
      id: p.id,
      year: p.year,
      month: p.month,
      status: p.status,
      label: formatPeriod(p.month, p.year),
    })),
    defaultPeriodId: openPeriod?.id ?? null,
    routes: routes.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      sortOrder: r.sortOrder,
    })),
    routeAccess,
    receipt: {
      vatPercent,
      contactPhones:
        process.env.INVOICE_CONTACT_PHONES?.trim() ?? "0973065179 - 0335345620",
      copyLabel: process.env.INVOICE_COPY_LABEL?.trim() ?? "2",
    },
  });
}
