import { NextResponse } from "next/server";
import { getCollectorForMobile, MobileAdminError } from "@/lib/mobileAdminCollectors";
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
    const collector = await getCollectorForMobile(id);
    return NextResponse.json(collector);
  } catch (e) {
    if (e instanceof MobileAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
