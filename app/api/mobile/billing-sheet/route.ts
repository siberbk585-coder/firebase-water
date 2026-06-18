import { NextResponse } from "next/server";
import { loadBillingSheetRows } from "@/lib/billingSheet";
import { matchesBillingSheetSearch } from "@/lib/billingSheetSearch";
import {
  assertCollectorRouteAccess,
  CollectorAccessError,
  getCollectorRouteIds,
  isAdmin,
} from "@/lib/collectorAccess";
import {
  requireStaffSession,
  staffForbidden,
  staffUnauthorized,
} from "@/lib/staffAuth";

export async function GET(request: Request) {
  const session = await requireStaffSession();
  if (!session) return staffUnauthorized();

  const { searchParams } = new URL(request.url);
  const periodId = searchParams.get("periodId");
  if (!periodId) {
    return NextResponse.json({ error: "Thiếu periodId" }, { status: 400 });
  }

  const routeId = searchParams.get("routeId");
  const q = searchParams.get("q")?.trim() ?? "";

  const allowedRouteIds = isAdmin(session) ? undefined : await getCollectorRouteIds(session.id);

  if (!isAdmin(session) && routeId) {
    try {
      await assertCollectorRouteAccess(session, routeId);
    } catch (e) {
      if (e instanceof CollectorAccessError) return staffForbidden(e.message);
      throw e;
    }
  }

  let rows = await loadBillingSheetRows(periodId, routeId || null, {
    allowedRouteIds,
  });

  if (q) {
    rows = rows.filter((r) =>
      matchesBillingSheetSearch(
        {
          householdCode: r.householdCode,
          meterCode: r.meterCode,
          residentName: r.residentName,
          address: r.address,
          contactPhone: r.contactPhone,
          routeName: r.routeName,
        },
        q
      )
    );
  }

  return NextResponse.json(rows);
}
