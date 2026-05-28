import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  formatAuditMetadata,
  formatMeterReadingAuditDetail,
  isEmptyAuditMetadata,
} from "@/lib/auditDisplay";
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

  const readingEnrichIds = [
    ...new Set(
      logs
        .filter(
          (l) =>
            l.entity === "MeterReading" &&
            l.entityId &&
            isEmptyAuditMetadata(l.metadata)
        )
        .map((l) => l.entityId as string)
    ),
  ];

  const readingsById = new Map(
    readingEnrichIds.length
      ? (
          await prisma.meterReading.findMany({
            where: { id: { in: readingEnrichIds } },
            include: {
              household: {
                select: { householdCode: true, meterCode: true },
              },
            },
          })
        ).map((r) => [r.id, r] as const)
      : []
  );

  const logRows = logs.map((log) => {
    if (
      log.entity === "MeterReading" &&
      log.entityId &&
      isEmptyAuditMetadata(log.metadata)
    ) {
      const reading = readingsById.get(log.entityId);
      if (reading) {
        return {
          log,
          detail: formatMeterReadingAuditDetail(reading, reading.household),
        };
      }
    }
    return { log, detail: formatAuditMetadata(log.metadata) };
  });

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
            Lịch sử thao tác: gửi/chốt chỉ số, hóa đơn, Excel, thanh toán… · Giờ
            hiển thị GMT+7
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
        {actionGroups.map((g) => (
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
            <span className="text-xs opacity-70">({g._count.action})</span>
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
              <th>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {logRows.map(({ log, detail }) => (
              <tr key={log.id} className="border-b text-sm">
                <td className="whitespace-nowrap text-[var(--muted)]">
                  {formatDateTimeVN(log.createdAt)}
                </td>
                <td>
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
                <td>
                  <span className="font-medium">{auditActionLabel(log.action)}</span>
                  <span className="block font-mono text-[10px] text-[var(--muted)]">
                    {log.action}
                  </span>
                </td>
                <td>
                  {entityLabel(log.entity)}
                  {log.entityId && (
                    <span className="block font-mono text-[10px] text-[var(--muted)]">
                      {log.entityId.length > 20
                        ? `${log.entityId.slice(0, 18)}…`
                        : log.entityId}
                    </span>
                  )}
                </td>
                <td className="max-w-md text-xs text-[var(--muted)]">
                  {detail}
                </td>
              </tr>
            ))}
            {!logs.length && (
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
