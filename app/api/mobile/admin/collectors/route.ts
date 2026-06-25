import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createCollectorForMobile,
  listCollectorsForMobile,
  MobileAdminError,
} from "@/lib/mobileAdminCollectors";
import { requireAdminApiAccess } from "@/lib/staffAuth";

const createSchema = z.object({
  username: z.string().trim().min(1),
  name: z.string().trim().min(1),
  password: z.string().min(6),
  routeIds: z.array(z.string()).min(1),
});

export async function GET() {
  const auth = await requireAdminApiAccess();
  if (!auth.ok) return auth.response;

  const collectors = await listCollectorsForMobile();
  return NextResponse.json({ collectors });
}

export async function POST(request: Request) {
  const auth = await requireAdminApiAccess();
  if (!auth.ok) return auth.response;

  try {
    const body = createSchema.parse(await request.json());
    const result = await createCollectorForMobile(auth.session, body);
    return NextResponse.json({ ok: true, ...result });
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
