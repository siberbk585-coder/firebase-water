import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { currentCalendarPeriod, getBillingPeriods, getCollectionRoutes } from "@/lib/billingSheet";
import { formatPeriod } from "@/lib/vi";
import { getVatPercent } from "@/lib/vatServer";
import { UserRole } from "@/lib/types/enums";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const [periods, routes, vatPercent] = await Promise.all([
    getBillingPeriods(),
    getCollectionRoutes(),
    getVatPercent(),
  ]);

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
    receipt: {
      vatPercent,
      contactPhones:
        process.env.INVOICE_CONTACT_PHONES?.trim() ?? "0973065179 - 0335345620",
      copyLabel: process.env.INVOICE_COPY_LABEL?.trim() ?? "2",
    },
  });
}
