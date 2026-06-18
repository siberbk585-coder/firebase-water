"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Period = { id: string; label: string };

export function BillingPeriodSelect({
  periods,
  activePeriodId,
  routeId,
  isSummary,
  basePath = "/admin/billing-sheet",
}: {
  periods: Period[];
  activePeriodId: string;
  routeId?: string;
  isSummary?: boolean;
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(periodId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", periodId);
    if (isSummary) {
      params.set("view", "summary");
      params.delete("route");
    } else if (routeId) {
      params.set("route", routeId);
      params.delete("view");
    } else {
      params.set("route", "all");
    }
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="billing-filter-control flex items-center gap-2 max-md:flex-col max-md:items-stretch max-md:gap-1">
      <label className="text-sm font-medium max-md:text-xs max-md:text-[var(--muted)]">
        Kỳ
      </label>
      <select
        className="input py-1.5 max-md:w-full"
        value={activePeriodId}
        onChange={(e) => onChange(e.target.value)}
      >
        {periods.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}
