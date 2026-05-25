import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { UserRole } from "@/lib/types/enums";;
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { rejectReading } from "@/lib/readings";

const schema = z.object({
  readingId: z.string(),
  reason: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  try {
    const reading = await rejectReading({
      readingId: parsed.data.readingId,
      actorId: session.id,
      reason: parsed.data.reason,
    });
    revalidatePath("/admin/billing-sheet");
    return NextResponse.json({ ok: true, reading });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không từ chối được";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
