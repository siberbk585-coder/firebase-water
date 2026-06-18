import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PREFIXES = [
  "/login",
  "/privacy",
  "/api/auth/login",
  "/api/auth/session",
  "/api/uploads/", // n8n / MCP upload ảnh (API key trong route)
  "/api/files/", // phục vụ ảnh local khi chưa có Blob
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/") ||
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get("__session")?.value;
  const hasBearer = request.headers
    .get("authorization")
    ?.toLowerCase()
    .startsWith("bearer ");
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));

  if (!session && !hasBearer && !isPublic && pathname !== "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
