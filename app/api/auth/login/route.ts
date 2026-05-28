import { NextResponse } from "next/server";
import { createAccessToken, login, setSessionCookie } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  phone: z.string().trim().min(3),
  password: z.string().min(4),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const user = await login(parsed.data.phone, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: "Sai tài khoản hoặc mật khẩu" }, { status: 401 });
  }

  await setSessionCookie(user);
  const token = createAccessToken(user);
  return NextResponse.json({
    ok: true,
    role: user.role,
    token,
    user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
  });
}
