"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Route = { id: string; name: string };

export function BillingRouteSelect({
  periodId,
  routes,
  activeRouteId,
  isSummary,
  basePath = "/admin/billing-sheet",
  showAllOption = true,
  showSummaryOption = true,
}: {
  periodId: string;
  routes: Route[];
  activeRouteId: string | null;
  isSummary: boolean;
  basePath?: string;
  showAllOption?: boolean;
  showSummaryOption?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function go(value: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("period", periodId);
    p.delete("route");
    p.delete("view");
    if (value === "all") {
      p.set("route", "all");
    } else if (value === "summary") {
      p.set("view", "summary");
    } else {
      p.set("route", value);
    }
    router.push(`${basePath}?${p.toString()}`);
  }

  const current = isSummary
    ? "summary"
    : activeRouteId === null
      ? showAllOption
        ? "all"
        : routes[0]?.id ?? ""
      : activeRouteId;

  return (
    <label className="billing-filter-control flex items-center gap-2 text-sm max-md:flex-col max-md:items-stretch max-md:gap-1">
      <span className="shrink-0 font-medium text-[var(--muted)] max-md:text-xs">
        Khu vực
      </span>
      <select
        className="input min-w-[10rem] py-1.5 max-md:w-full max-md:min-w-0"
        value={current}
        onChange={(e) => go(e.target.value)}
      >
        {showAllOption && <option value="all">Tất cả hộ (bảng tổng)</option>}
        {routes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
        {showSummaryOption && <option value="summary">Chỉ xem tổng theo khu vực</option>}
      </select>
    </label>
  );
}
