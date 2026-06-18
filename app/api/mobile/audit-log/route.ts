import { NextResponse } from "next/server";
import { queryAuditLogs } from "@/lib/auditQuery";
import { isAdmin, isStaff } from "@/lib/collectorAccess";
import {
  requireStaffSession,
  staffForbidden,
  staffUnauthorized,
} from "@/lib/staffAuth";
import { UserRole } from "@/lib/types/enums";

/** Nhật ký hệ thống — admin xem tất cả; thu hộ chỉ xem hoạt động mobile của mình. */
export async function GET(request: Request) {
  const session = await requireStaffSession();
  if (!session) return staffUnauthorized();
  if (!isStaff(session)) return staffForbidden();

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") ?? "50", 10);
  const action = url.searchParams.get("action") ?? undefined;
  const sourceParam = url.searchParams.get("source");
  const mineOnly = url.searchParams.get("mine") === "1";

  const source =
    sourceParam === "MOBILE" || sourceParam === "WEB"
      ? sourceParam
      : undefined;

  if (session.role === UserRole.COLLECTOR) {
    const data = await queryAuditLogs({
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 50,
      action: action || undefined,
      actorId: session.id,
      source: "MOBILE",
    });
    return NextResponse.json(data);
  }

  if (!isAdmin(session)) {
    return staffForbidden();
  }

  const data = await queryAuditLogs({
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 50,
    action: action || undefined,
    actorId: mineOnly ? session.id : undefined,
    source,
  });

  return NextResponse.json(data);
}
