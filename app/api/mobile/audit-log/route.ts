import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryAuditLogs } from "@/lib/auditQuery";
import { UserRole } from "@/lib/types/enums";

/** Nhật ký hệ thống — dùng chung web + app mobile (admin). */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

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

  const data = await queryAuditLogs({
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 50,
    action: action || undefined,
    actorId: mineOnly ? session.id : undefined,
    source,
  });

  return NextResponse.json(data);
}
