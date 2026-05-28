import bcrypt from "bcryptjs";
import { createHmac } from "crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/data/prisma";
import { UserRole } from "@/lib/types/enums";
import { resolveSessionFromIdToken } from "@/lib/firebaseAuth";
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

/** Token Bearer (cùng định dạng cookie đã ký) — dùng cho client gọi API ngoài trình duyệt. */
export function createAccessToken(user: SessionUser): string {
  return sign(encodeSession(user));
}

async function sessionFromSignedToken(signed: string): Promise<SessionUser | null> {
  const token = verify(signed);
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

/** Bearer: session đã ký hoặc Firebase ID token (3 phần JWT). */
export async function resolveBearerToken(bearer: string): Promise<SessionUser | null> {
  const trimmed = bearer.trim();
  if (!trimmed) return null;

  const fromSigned = await sessionFromSignedToken(trimmed);
  if (fromSigned) return fromSigned;

  if (trimmed.split(".").length === 3) {
    try {
      return await resolveSessionFromIdToken(trimmed);
    } catch {
      return null;
    }
  }

  return null;
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const cookieRaw = jar.get(SESSION_COOKIE)?.value;
  if (cookieRaw) {
    const fromCookie = await sessionFromSignedToken(cookieRaw);
    if (fromCookie) return fromCookie;
  }

  const h = await headers();
  const auth = h.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return resolveBearerToken(auth.slice(7));
  }

  return null;
}

export function requireRole(user: SessionUser | null, role: UserRole): boolean {
  return user?.role === role;
}
