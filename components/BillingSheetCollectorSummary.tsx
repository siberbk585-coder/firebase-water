import type { BillingSheetMoneySummary } from "@/lib/billingSheetSummary";

function formatVnd(n: number): string {
  return Math.round(n).toLocaleString("vi-VN");
}

export function BillingSheetCollectorSummary({
  summary,
  routeLabel,
}: {
  summary: BillingSheetMoneySummary;
  routeLabel: string;
}) {
  return (
    <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <p className="mb-2 text-xs font-semibold text-[var(--muted)]">
        Tổng hợp — {routeLabel}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard
          label="Phụ trách"
          value={`${summary.totalHouseholds}`}
          hint="hộ trong khu vực"
          tone="mint"
        />
        <SummaryCard
          label="Đã thu"
          value={`${summary.paidHouseholds}`}
          hint={`${formatVnd(summary.paidAmount)} đ`}
          tone="pink"
        />
        <SummaryCard
          label="Chưa thu"
          value={`${summary.unpaidHouseholds}`}
          hint="hộ đã chốt"
          tone="yellow"
        />
        <SummaryCard
          label="Còn"
          value={`${formatVnd(summary.unpaidAmount)} đ`}
          hint="chốt chưa thu"
          tone="blue"
          valueClass={summary.unpaidAmount > 0 ? "text-amber-700" : undefined}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
  valueClass,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "mint" | "yellow" | "blue" | "pink";
  valueClass?: string;
}) {
  const border = {
    mint: "border-emerald-200 bg-emerald-50",
    yellow: "border-amber-200 bg-amber-50",
    blue: "border-sky-200 bg-sky-50",
    pink: "border-rose-200 bg-rose-50",
  }[tone];

  return (
    <div className={`rounded-lg border px-3 py-2 ${border}`}>
      <div className="text-xs font-semibold text-[var(--muted)]">{label}</div>
      <div
        className={`text-lg font-bold leading-tight ${valueClass ?? "text-[var(--foreground)]"}`}
      >
        {value}
      </div>
      <div className="text-[11px] text-[var(--muted)]">{hint}</div>
    </div>
  );
}
