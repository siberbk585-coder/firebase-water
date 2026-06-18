import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/data/prisma";
import { UserRole } from "@/lib/types/enums";
import { updateCollectorRoutes } from "../actions";
import { CollectorStatusButton } from "../CollectorStatusButton";

export default async function CollectorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [collector, routes] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        collectorRoutes: { select: { routeId: true } },
      },
    }),
    prisma.collectionRoute.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  if (!collector || collector.role !== UserRole.COLLECTOR) notFound();

  const assigned = new Set(collector.collectorRoutes.map((r) => r.routeId));

  return (
    <>
      <div className="mb-4">
        <Link href="/admin/collectors" className="text-sm text-[var(--primary)] hover:underline">
          ← Danh sách tài khoản thu hộ
        </Link>
      </div>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{collector.name}</h1>
          <p className="font-mono text-sm text-[var(--muted)]">@{collector.username}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              "badge",
              collector.isActive ? "badge-success" : "bg-slate-100 text-slate-600",
            ].join(" ")}
          >
            {collector.isActive ? "Đang hoạt động" : "Đã đóng"}
          </span>
          <CollectorStatusButton
            collectorId={collector.id}
            username={collector.username}
            isActive={collector.isActive}
          />
        </div>
      </header>

      {error && (
        <div className="card mb-4 border-[var(--danger)]/30 bg-red-50 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Khu vực được thu</h2>
        <form action={updateCollectorRoutes.bind(null, collector.id)} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {routes.map((r) => (
              <label key={r.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <input
                  type="checkbox"
                  name="routeIds"
                  value={r.id}
                  defaultChecked={assigned.has(r.id)}
                />
                <span>{r.name}</span>
              </label>
            ))}
          </div>
          <button type="submit" className="btn btn-primary">
            Lưu phân quyền khu vực
          </button>
        </form>
      </section>
    </>
  );
}
