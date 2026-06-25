import { NextResponse } from "next/server";
import { getCollectorForMobile, MobileAdminError } from "@/lib/mobileAdminCollectors";
import { requireAdminApiAccess } from "@/lib/staffAuth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAccess();
  if (!auth.ok) return auth.response;

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
