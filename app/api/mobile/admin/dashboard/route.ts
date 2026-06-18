import { NextResponse } from "next/server";
import { getAdminDashboard } from "@/lib/adminDashboard";
import {
  requireAdminSession,
  staffUnauthorized,
} from "@/lib/staffAuth";

export async function GET(request: Request) {
  const session = await requireAdminSession();
  if (!session) return staffUnauthorized();

  const periodId = new URL(request.url).searchParams.get("periodId") ?? undefined;
  const data = await getAdminDashboard(periodId);
  if (!data) {
    return NextResponse.json({ error: "Chưa có kỳ thu." }, { status: 404 });
  }

  return NextResponse.json(data);
}
