import Link from "next/link";
import { prisma } from "@/lib/data/prisma";
import { UserRole } from "@/lib/types/enums";
import { userRoleLabel } from "@/lib/vi";
import { AddCollectorModal } from "./AddCollectorModal";

export default async function AdminCollectorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const [collectors, routes] = await Promise.all([
    prisma.user.findMany({
      where: { role: UserRole.COLLECTOR },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: {
        collectorRoutes: {
          include: { route: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.collectionRoute.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tài khoản thu hộ</h1>
          <p className="text-sm text-[var(--muted)]">
            Người thu chỉ được nhập chỉ số, xác nhận thanh toán và in hóa đơn trên khu vực được gán.
          </p>
        </div>
        <AddCollectorModal routes={routes} />
      </div>

      {error && (
        <div className="card mb-3 border-[var(--danger)]/30 bg-red-50 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="table-modern">
          <thead className="border-b bg-slate-50/70 text-left">
            <tr>
              <th>Tên đăng nhập</th>
              <th>Họ tên</th>
              <th>Khu vực</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {collectors.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="font-mono font-semibold">{c.username ?? "—"}</td>
                <td>{c.name}</td>
                <td className="text-sm">
                  {c.collectorRoutes.length
                    ? c.collectorRoutes.map((cr) => cr.route.name).join(", ")
                    : "—"}
                </td>
                <td>
                  <span
                    className={[
                      "badge",
                      c.isActive ? "badge-success" : "bg-slate-100 text-slate-600",
                    ].join(" ")}
                  >
                    {c.isActive ? userRoleLabel(c.role) : "Đã đóng"}
                  </span>
                </td>
                <td>
                  <Link
                    href={`/admin/collectors/${c.id}`}
                    className="text-sm font-semibold text-[var(--primary)] hover:underline"
                  >
                    Chi tiết
                  </Link>
                </td>
              </tr>
            ))}
            {!collectors.length && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-[var(--muted)]">
                  Chưa có tài khoản thu hộ.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
