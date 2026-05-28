import { NextResponse } from "next/server";
import { createAccessToken, setSessionCookie } from "@/lib/auth";
import { resolveSessionFromIdToken } from "@/lib/firebaseAuth";
import { z } from "zod";

const schema = z.object({
  idToken: z.string().min(10),
});

/** Đổi Firebase ID token → session cookie (phân quyền từ Postgres). */
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  try {
    const user = await resolveSessionFromIdToken(parsed.data.idToken);
    if (!user) {
      return NextResponse.json(
        { error: "Tài khoản chưa được cấp quyền trong hệ thống" },
        { status: 403 }
      );
    }
    await setSessionCookie(user);
    const token = createAccessToken(user);
    return NextResponse.json({
      ok: true,
      role: user.role,
      token,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
    });
  } catch (e) {
    console.error("auth/session", e);
    return NextResponse.json({ error: "Token không hợp lệ" }, { status: 401 });
  }
}
