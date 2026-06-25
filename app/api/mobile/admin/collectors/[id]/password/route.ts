import { NextResponse } from "next/server";
import { z } from "zod";
import {
  MobileAdminError,
  resetCollectorPasswordForMobile,
} from "@/lib/mobileAdminCollectors";
import { requireAdminApiAccess } from "@/lib/staffAuth";

const schema = z.object({
  password: z.string().min(6),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAccess();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = schema.parse(await request.json());
    await resetCollectorPasswordForMobile(auth.session, id, body.password);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof MobileAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    throw e;
  }
}
