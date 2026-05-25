import { NextResponse } from "next/server";
import { UserRole } from "@/lib/types/enums";;
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getSystemSettings, updateSystemSettings } from "@/lib/settings";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  const settings = await getSystemSettings();
  return NextResponse.json({ settings });
}

const patchSchema = z.object({
  periodCloseDay: z.number().int().min(1).max(28).optional(),
  timezone: z.string().optional(),
});

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  try {
    const settings = await updateSystemSettings(parsed.data);
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không lưu được";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
