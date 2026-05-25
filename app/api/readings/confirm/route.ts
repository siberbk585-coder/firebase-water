import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { confirmReading } from "@/lib/readings";
import { InputMethod } from "@/lib/types/enums";;
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  readingId: z.string(),
  confirmedValue: z.number().positive(),
  inputMethod: z.enum(["OCR_CONFIRMED", "OCR_EDITED", "MANUAL"]),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.householdId) {
    return NextResponse.json({ error: "Chưa đăng nhập hoặc chưa gắn hộ dân" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  try {
    const reading = await confirmReading({
      readingId: parsed.data.readingId,
      confirmedValue: parsed.data.confirmedValue,
      inputMethod: parsed.data.inputMethod as InputMethod,
      actorId: session.id,
    });
    await logAudit({
      actorId: session.id,
      action: "READING_CONFIRMED",
      entity: "MeterReading",
      entityId: reading.id,
    });
    return NextResponse.json({ ok: true, reading });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không lưu được";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
