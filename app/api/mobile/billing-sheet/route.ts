import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadBillingSheetRows } from "@/lib/billingSheet";
import { UserRole } from "@/lib/types/enums";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const periodId = searchParams.get("periodId");
  if (!periodId) {
    return NextResponse.json({ error: "Thiếu periodId" }, { status: 400 });
  }

  const routeId = searchParams.get("routeId");
  const q = searchParams.get("q")?.trim().toLowerCase();

  let rows = await loadBillingSheetRows(periodId, routeId || null);

  if (q) {
    rows = rows.filter(
      (r) =>
        r.residentName.toLowerCase().includes(q) ||
        r.meterCode.toLowerCase().includes(q) ||
        r.householdCode.toLowerCase().includes(q) ||
        (r.contactPhone?.toLowerCase().includes(q) ?? false)
    );
  }

  return NextResponse.json(rows);
}
