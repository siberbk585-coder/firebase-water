import { NextResponse } from "next/server";
import {
  MobileAdminError,
  setCollectorActiveForMobile,
} from "@/lib/mobileAdminCollectors";
import { requireAdminApiAccess } from "@/lib/staffAuth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAccess();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    await setCollectorActiveForMobile(auth.session, id, true);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof MobileAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
