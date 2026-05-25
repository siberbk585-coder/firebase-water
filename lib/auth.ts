import bcrypt from "bcryptjs";
import { createHmac } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/data/prisma";
import { UserRole } from "@/lib/types/enums";
import { env } from "./env";

/** Firebase Hosting chỉ forward cookie `__session` tới Cloud Run (CDN). */
const SESSION_COOKIE = "__session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  householdId?: string;
};

function encodeSession(payload: SessionUser): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeSession(token: string): SessionUser | null {
  try {
    return JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as SessionUser;
  } catch {
    return null;
  }
}

function sign(token: string): string {
  const secret = env.sessionSecret();
  const sig = createHmac("sha256", secret).update(token).digest("base64url");
  return `${token}.${sig}`;
}

function verify(signed: string): string | null {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const token = signed.slice(0, lastDot);
  const expected = sign(token);
  if (expected !== signed) return null;
  return token;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function toSessionUser(user: {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  household?: { id: string } | null;
}): SessionUser {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    householdId: user.household?.id,
  };
}

/** Đăng nhập legacy (bcrypt) — dùng khi chưa có tài khoản Firebase. */
export async function login(phone: string, password: string): Promise<SessionUser | null> {
  const account = phone.trim();
  const user = await prisma.user.findUnique({
    where: { phone: account },
    include: { household: true },
  });
  if (!user?.passwordHash) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return toSessionUser(user);
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = sign(encodeSession(user));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const token = verify(raw);
  if (!token) return null;
  const decoded = decodeSession(token);
  if (!decoded?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    include: { household: true },
  });
  if (!user) return null;

  return toSessionUser(user);
}

export function requireRole(user: SessionUser | null, role: UserRole): boolean {
  return user?.role === role;
}
