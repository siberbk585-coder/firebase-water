import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  excludeSandboxHouseholdWhere,
  excludeSandboxRoutesWhere,
} from "@/lib/sandboxRoutes";
import { AssignHouseholdForm } from "@/components/AssignHouseholdForm";
import { createRoute, updateRoute, assignHouseholdToRoute } from "./actions";

export default async function AdminRoutesPage({
  searchParams,
}: {
  searchParams: Promise<{ route?: string }>;
}) {
  const { route: selectedRouteId } = await searchParams;

  const [routes, households] = await Promise.all([
    prisma.collectionRoute.findMany({
      where: excludeSandboxRoutesWhere(),
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { households: true } } },
    }),
    prisma.household.findMany({
      where: { status: "ACTIVE", ...excludeSandboxHouseholdWhere() },
      orderBy: [{ collectionRouteId: "asc" }, { routeSortOrder: "asc" }, { householdCode: "asc" }],
      include: { collectionRoute: true },
    }),
  ]);

  const activeRouteId = selectedRouteId ?? routes[0]?.id;
  const routeHouseholds = activeRouteId
    ? households.filter((h) => h.collectionRouteId === activeRouteId)
    : [];
  const unassigned = households.filter((h) => !h.collectionRouteId);

  const householdOptions = households.map((h) => ({
    id: h.id,
    householdCode: h.householdCode,
    residentName: h.residentName,
    routeLabel: h.collectionRoute
      ? `Đang ở: ${h.collectionRoute.name}`
      : "Chưa gán tuyến",
  }));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tuyến thu</h1>
          <p className="text-sm text-[var(--muted)]">
            Mỗi tuyến tương ứng một tab Excel (ĐƯỜNG 212, BẢNG VIÊN…). Gán hộ và STT trong tuyến.
          </p>
        </div>
        <Link href="/admin/billing-sheet" className="btn btn-primary text-sm">
          Mở bảng ghi chỉ số
        </Link>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">Thêm tuyến</h2>
          <form action={createRoute} className="flex flex-wrap gap-2">
            <input name="code" placeholder="Mã (vd: 212)" className="input flex-1 min-w-[80px]" required />
            <input name="name" placeholder="Tên (vd: ĐƯỜNG 212)" className="input flex-[2] min-w-[140px]" required />
            <input name="sortOrder" type="number" placeholder="TT" className="input w-16" defaultValue={routes.length + 1} />
            <button type="submit" className="btn btn-primary">
              Thêm
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold">Danh sách tuyến</h2>
          <ul className="space-y-2">
            {routes.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
                <Link
                  href={`/admin/routes?route=${r.id}`}
                  className={[
                    "font-semibold",
                    activeRouteId === r.id ? "text-[var(--primary)]" : "",
                  ].join(" ")}
                >
                  {r.name}
                </Link>
                <span className="text-xs text-[var(--muted)]">
                  {r._count.households} hộ · mã {r.code}
                </span>
                <form action={updateRoute} className="ml-auto flex gap-1">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="name" defaultValue={r.name} className="input py-1 text-sm w-32" />
                  <input name="sortOrder" type="number" defaultValue={r.sortOrder} className="input py-1 text-sm w-14" />
                  <button type="submit" className="btn btn-secondary py-1 text-xs">
                    Sửa
                  </button>
                </form>
              </li>
            ))}
            {!routes.length && <li className="text-sm text-[var(--muted)]">Chưa có tuyến</li>}
          </ul>
        </div>
      </div>

      {activeRouteId && (
        <div className="card mb-8">
          <h2 className="mb-3 font-semibold">
            Hộ trong tuyến: {routes.find((r) => r.id === activeRouteId)?.name}
          </h2>
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead className="border-b bg-slate-50 text-left text-sm">
                <tr>
                  <th>STT</th>
                  <th>MKH</th>
                  <th>Họ và tên</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {routeHouseholds.map((h) => (
                  <tr key={h.id} className="border-b">
                    <td>{h.routeSortOrder ?? "—"}</td>
                    <td className="font-mono">{h.householdCode}</td>
                    <td>{h.residentName}</td>
                    <td>
                      <Link href={`/admin/households/${h.id}`} className="text-sm text-[var(--primary)]">
                        Chi tiết
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="mb-3 font-semibold">Gán hộ vào tuyến</h2>
        <p className="mb-2 text-sm text-[var(--muted)]">
          Gõ mã MKH hoặc tên hộ để tìm, chọn một dòng trong danh sách gợi ý.
        </p>
        <AssignHouseholdForm
          households={householdOptions}
          routes={routes.map((r) => ({ id: r.id, name: r.name }))}
          defaultRouteId={activeRouteId}
          assignAction={assignHouseholdToRoute}
        />
        {unassigned.length > 0 && (
          <p className="text-sm text-[var(--warning)]">{unassigned.length} hộ chưa gán tuyến</p>
        )}
      </div>
    </>
  );
}
