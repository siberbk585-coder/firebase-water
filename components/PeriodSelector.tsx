"use client";

import { useRouter } from "next/navigation";

type Period = {
  id: string;
  month: number;
  year: number;
  status: string;
};

export function PeriodSelector({
  periods,
  currentPeriodId,
  basePath = "/admin/dashboard",
}: {
  periods: Period[];
  currentPeriodId: string;
  basePath?: string;
}) {
  const router = useRouter();

  return (
    <select
      value={currentPeriodId}
      onChange={(e) => router.push(`${basePath}?period=${e.target.value}`)}
      className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm text-[var(--fg)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
    >
      {periods.map((p) => (
        <option key={p.id} value={p.id}>
          Tháng {p.month}/{p.year}
          {p.status === "OPEN" ? " — Đang mở" : ""}
        </option>
      ))}
    </select>
  );
}
