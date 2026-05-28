import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBillingPeriods, getCollectionRoutes } from "@/lib/billingSheet";
import { formatPeriod } from "@/lib/vi";
import { UserRole } from "@/lib/types/enums";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const [periods, routes] = await Promise.all([
    getBillingPeriods(),
    getCollectionRoutes(),
  ]);

  const openPeriod = periods.find((p) => p.status === "OPEN") ?? periods[0];

  return NextResponse.json({
    user: {
      id: session.id,
      name: session.name,
      phone: session.phone,
      role: session.role,
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
  });
}
