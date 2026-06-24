import Link from "next/link";
import { AuditDetailList } from "@/components/AuditDetailList";
import { prisma } from "@/lib/db";
import { enrichAuditLogRows } from "@/lib/auditEnrich";
import { mergeAuditActionCounts } from "@/lib/auditQuery";
import { formatDateTimeVN } from "@/lib/datetime";
import {
  auditActionLabel,
  entityLabel,
  userRoleLabel,
} from "@/lib/vi";

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  const { page: pageStr, action: actionFilter } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = actionFilter ? { action: actionFilter } : {};

  const [logs, total, actionGroups] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip,
      include: {
        actor: { select: { name: true, phone: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ["action"],
      _count: { action: true },
      orderBy: { _count: { action: "desc" } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = await enrichAuditLogRows(logs);

  function pageHref(p: number, action?: string) {
    const q = new URLSearchParams();
    if (p > 1) q.set("page", String(p));
    if (action) q.set("action", action);
    const s = q.toString();
    return `/admin/audit-log${s ? `?${s}` : ""}`;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Nhật ký hệ thống</h1>
          <p className="text-sm text-[var(--muted)]">
            Lịch sử thao tác chi tiết: hộ, kỳ, chỉ số, hóa đơn, thu tiền, Excel… ·
            Giờ GMT+7
          </p>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Tổng <strong>{total}</strong> bản ghi
        </p>
      </div>

      <div className="card mb-4 flex flex-wrap gap-2">
        <Link
          href="/admin/audit-log"
          className={`rounded-lg px-3 py-1.5 text-sm ${
            !actionFilter
              ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary-dark)]"
              : "bg-slate-100 text-[var(--muted)] hover:bg-slate-200"
          }`}
        >
          Tất cả
        </Link>
        {mergeAuditActionCounts(actionGroups).map((g) => (
          <Link
            key={g.action}
            href={pageHref(1, g.action)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              actionFilter === g.action
                ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary-dark)]"
                : "bg-slate-100 text-[var(--muted)] hover:bg-slate-200"
            }`}
          >
            {auditActionLabel(g.action)}{" "}
            <span className="text-xs opacity-70">({g.count})</span>
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto card p-0">
        <table className="table-modern">
          <thead className="border-b bg-slate-50/70 text-left text-sm">
            <tr>
              <th className="whitespace-nowrap">Thời gian</th>
              <th>Người thực hiện</th>
              <th>Thao tác</th>
              <th>Đối tượng</th>
              <th className="min-w-[14rem]">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ log, lines, entityHref, entitySummary }) => (
              <tr key={log.id} className="border-b text-sm align-top">
                <td className="whitespace-nowrap py-3 text-[var(--muted)]">
                  {formatDateTimeVN(log.createdAt)}
                </td>
                <td className="py-3">
                  {log.actor ? (
                    <>
                      <span className="font-medium">{log.actor.name}</span>
                      <span className="block text-xs text-[var(--muted)]">
                        {log.actor.phone} · {userRoleLabel(log.actor.role)}
                      </span>
                    </>
                  ) : (
                    <span className="text-[var(--muted)]">Hệ thống</span>
                  )}
                </td>
                <td className="py-3">
                  <span className="font-medium">
                    {auditActionLabel(log.action)}
                  </span>
                </td>
                <td className="py-3">
                  <span className="text-[var(--muted)]">
                    {entityLabel(log.entity)}
                  </span>
                  {entitySummary ? (
                    entityHref ? (
                      <Link
                        href={entityHref}
                        className="mt-0.5 block font-medium text-[var(--primary)] hover:underline"
                      >
                        {entitySummary}
                      </Link>
                    ) : (
                      <span className="mt-0.5 block font-medium">
                        {entitySummary}
                      </span>
                    )
                  ) : log.entityId ? (
                    <span className="mt-0.5 block font-mono text-[10px] text-[var(--muted)]">
                      {log.entityId.length > 24
                        ? `${log.entityId.slice(0, 22)}…`
                        : log.entityId}
                    </span>
                  ) : null}
                </td>
                <td className="max-w-md py-3">
                  <AuditDetailList lines={lines} />
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-[var(--muted)]">
                  Chưa có nhật ký{actionFilter ? " cho bộ lọc này" : ""}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link
              href={pageHref(page - 1, actionFilter)}
              className="btn btn-secondary py-1.5 text-xs"
            >
              ← Trước
            </Link>
          )}
          <span className="text-[var(--muted)]">
            Trang {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={pageHref(page + 1, actionFilter)}
              className="btn btn-secondary py-1.5 text-xs"
            >
              Sau →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
