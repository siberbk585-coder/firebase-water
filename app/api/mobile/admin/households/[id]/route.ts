import { NextResponse } from "next/server";
import { MobileAdminError } from "@/lib/mobileAdminCollectors";
import {
  deleteHouseholdForMobile,
  getHouseholdForMobile,
} from "@/lib/mobileAdminHouseholds";
import {
  requireAdminSession,
  staffUnauthorized,
} from "@/lib/staffAuth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) return staffUnauthorized();

  try {
    const { id } = await params;
    const household = await getHouseholdForMobile(id);
    return NextResponse.json(household);
  } catch (e) {
    if (e instanceof MobileAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) return staffUnauthorized();

  try {
    const { id } = await params;
    await deleteHouseholdForMobile(session, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof MobileAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
