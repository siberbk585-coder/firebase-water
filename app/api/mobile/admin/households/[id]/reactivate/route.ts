import { NextResponse } from "next/server";
import { MobileAdminError } from "@/lib/mobileAdminCollectors";
import { reactivateHouseholdForMobile } from "@/lib/mobileAdminHouseholds";
import {
  requireAdminSession,
  staffUnauthorized,
} from "@/lib/staffAuth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) return staffUnauthorized();

  try {
    const { id } = await params;
    await reactivateHouseholdForMobile(session, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof MobileAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
