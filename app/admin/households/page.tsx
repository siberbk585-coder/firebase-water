import Link from "next/link";
import { prisma } from "@/lib/db";
import { latestReading, readingCounts } from "@/lib/household";
import { formatPeriod, householdStatusLabel, readingStatusLabel } from "@/lib/vi";
import { AddHouseholdModal } from "@/components/AddHouseholdModal";

export default async function AdminHouseholdsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; error?: string }>;
}) {
  const { q, page: pageParam, error } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const pageSize = 50;
  const skip = (page - 1) * pageSize;

  const where = q?.trim()
    ? {
        OR: [
          { householdCode: { contains: q.trim(), mode: "insensitive" as const } },
          { meterCode: { contains: q.trim(), mode: "insensitive" as const } },
          { residentName: { contains: q.trim(), mode: "insensitive" as const } },
          { address: { contains: q.trim(), mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const [households, total, routes] = await Promise.all([
    prisma.household.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { householdCode: "asc" },
      include: {
        user: { select: { phone: true } },
        readings: {
          include: { period: true },
          orderBy: [{ period: { year: "desc" } }, { period: { month: "desc" } }],
        },
      },
    }),
    prisma.household.count({ where }),
    prisma.collectionRoute.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quản lý hộ dân</h1>
          <p className="text-sm text-[var(--muted)]">
            Trung tâm theo hộ — mỗi hộ một mã, một đồng hồ, lịch sử chỉ số trong chi tiết.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end md:w-auto">
          <AddHouseholdModal routes={routes} />
          <form className="flex w-full flex-col gap-2 sm:flex-row md:w-auto" method="get">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Tìm mã hộ, đồng hồ, tên..."
              className="input md:min-w-[220px]"
            />
            <button type="submit" className="btn btn-secondary">
              Tìm
            </button>
          </form>
        </div>
      </div>

      {error && (
        <div className="card mb-3 border-[var(--danger)]/30 bg-red-50 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      <p className="mb-3 text-sm text-slate-600">
        {total} hộ — trang {page}/{totalPages}
      </p>

      <div className="space-y-3 md:hidden">
        {households.map((h) => {
          const latest = latestReading(h.readings);
          const counts = readingCounts(h.readings);
          return (
            <article key={h.id} className="mobile-action-card">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/admin/households/${h.id}`}
                    className="font-mono text-base font-bold text-[var(--primary-dark)] hover:underline"
                  >
                    {h.householdCode}
                  </Link>
                  <h2 className="mt-1 truncate text-sm font-semibold">{h.residentName}</h2>
                  <p className="text-xs text-[var(--muted)]">{h.address}</p>
                </div>
                <span
                  className={[
                    "badge shrink-0",
                    h.status === "ACTIVE" ? "badge-success" : "badge-danger",
                  ].join(" ")}
                >
                  {householdStatusLabel(h.status)}
                </span>
              </div>

              <div className="mobile-meta-grid">
                <div>
                  <span className="mobile-meta-label">Đồng hồ</span>
                  <span className="font-mono font-semibold">{h.meterCode}</span>
                </div>
                <div>
                  <span className="mobile-meta-label">SĐT</span>
                  <span className="font-semibold">{h.user?.phone ?? "—"}</span>
                </div>
                <div>
                  <span className="mobile-meta-label">Kỳ gần nhất</span>
                  <span className="font-semibold">
                    {latest ? formatPeriod(latest.period.month, latest.period.year) : "—"}
                  </span>
                </div>
                <div>
                  <span className="mobile-meta-label">Chỉ số</span>
                  <span className="font-semibold">
                    {counts.total} kỳ
                    {counts.pending > 0 ? ` · ${counts.pending} chờ` : ""}
                  </span>
                </div>
              </div>

              {latest && (
                <p className="mt-3 text-xs text-[var(--muted)]">
                  Trạng thái kỳ gần nhất:{" "}
                  <strong>{readingStatusLabel(latest.status)}</strong>
                </p>
              )}

              <Link
                href={`/admin/households/${h.id}`}
                className="btn btn-secondary mt-3 w-full text-sm"
              >
                Chi tiết
              </Link>
            </article>
          );
        })}
        {!households.length && (
          <div className="card text-center text-sm text-slate-500">
            Không có hộ dân khớp điều kiện lọc.
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto card p-0 md:block">
        <table className="table-modern">
          <thead className="border-b bg-slate-50/70 text-left">
            <tr>
              <th>Mã hộ</th>
              <th>Đồng hồ</th>
              <th>Chủ hộ</th>
              <th>Kỳ gần nhất</th>
              <th>Chỉ số</th>
              <th>Trạng thái hộ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {households.map((h) => {
              const latest = latestReading(h.readings);
              const counts = readingCounts(h.readings);
              return (
                <tr key={h.id} className="border-b">
                  <td className="font-mono font-semibold">
                    <Link
                      href={`/admin/households/${h.id}`}
                      className="text-[var(--primary)] hover:underline"
                    >
                      {h.householdCode}
                    </Link>
                  </td>
                  <td className="font-mono text-sm">{h.meterCode}</td>
                  <td>
                    <div className="font-medium">{h.residentName}</div>
                    <div className="text-xs text-[var(--muted)]">{h.address}</div>
                  </td>
                  <td>
                    {latest
                      ? formatPeriod(latest.period.month, latest.period.year)
                      : "—"}
                  </td>
                  <td className="text-sm">
                    {counts.total} kỳ
                    {counts.pending > 0 && (
                      <span className="badge badge-warning ml-1">
                        {counts.pending} chờ
                      </span>
                    )}
                    {latest && (
                      <div className="text-xs text-[var(--muted)]">
                        {readingStatusLabel(latest.status)}
                      </div>
                    )}
                  </td>
                  <td>{householdStatusLabel(h.status)}</td>
                  <td>
                    <Link
                      href={`/admin/households/${h.id}`}
                      className="text-sm font-semibold text-[var(--primary)] hover:underline"
                    >
                      Chi tiết →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!households.length && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500">
                  Không có hộ dân khớp điều kiện lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex gap-2">
          {page > 1 && (
            <Link
              href={`/admin/households?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className="btn btn-secondary"
            >
              ← Trước
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/admin/households?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className="btn btn-secondary"
            >
              Sau →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
