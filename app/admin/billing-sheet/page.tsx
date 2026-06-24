import Link from "next/link";
import { Suspense } from "react";
import {
  currentCalendarPeriod,
  getBillingPeriods,
  getCollectionRoutes,
  loadBillingSheetRows,
  loadRouteSummaries,
} from "@/lib/billingSheet";
import { BillingSheetGrid } from "@/components/BillingSheetGrid";
import {
  countBillingSheetStatusFilter,
  parseBillingSheetStatusFilter,
  type BillingSheetStatusFilter,
} from "@/lib/billingSheetFilters";
import { BillingSheetSummary } from "@/components/BillingSheetSummary";
import { BillingPeriodSelect } from "@/components/BillingPeriodSelect";
import { BillingRouteSelect } from "@/components/BillingRouteSelect";
import { BillingExcelPanel } from "@/components/BillingExcelPanel";
import { BillingPrintPanel } from "@/components/BillingPrintPanel";
import { BillingSheetSearchControl } from "@/components/BillingSheetSearchControl";
import { BillingPrintSelectionProvider } from "@/components/billing-print-selection";
import { formatPeriod } from "@/lib/vi";
import { getVatPercent } from "@/lib/vatServer";

export default async function BillingSheetPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    route?: string;
    view?: string;
    status?: string;
    imported?: string;
    paid?: string;
    errors?: string;
    message?: string;
    durationMs?: string;
    q?: string;
  }>;
}) {
  const {
    period: periodId,
    route: routeParam,
    view,
    q: searchQuery,
    status: statusParam,
    imported,
    paid,
    errors,
    message,
    durationMs,
  } = await searchParams;
  const statusFilter = parseBillingSheetStatusFilter(statusParam);
  const [periods, routes, vatPercent] = await Promise.all([
    getBillingPeriods(),
    getCollectionRoutes(),
    getVatPercent(),
  ]);

  const cal = currentCalendarPeriod();
  const activePeriod =
    periods.find((p) => p.id === periodId) ??
    periods.find((p) => p.year === cal.year && p.month === cal.month) ??
    periods.find((p) => p.status === "OPEN") ??
    periods[0];

  if (!activePeriod) {
    return (
      <>
        <h1 className="text-2xl font-bold">Bảng thu nước</h1>
        <p className="text-[var(--muted)]">Chưa có kỳ thu. Liên hệ quản trị để tạo kỳ.</p>
      </>
    );
  }

  const periodLabel = formatPeriod(activePeriod.month, activePeriod.year);
  const isSummary = view === "summary" || routeParam === "summary";
  const isAll = routeParam === "all" || (!routeParam && !isSummary);
  const activeRoute =
    !isSummary && !isAll && routeParam
      ? routes.find((r) => r.id === routeParam) ?? null
      : null;

  const rows = isSummary
    ? []
    : await loadBillingSheetRows(
        activePeriod.id,
        isAll ? null : activeRoute?.id ?? null
      );
  const summaries = isSummary ? await loadRouteSummaries(activePeriod.id) : [];

  const pendingCount = countBillingSheetStatusFilter(rows, "pending");
  const confirmedCount = countBillingSheetStatusFilter(rows, "confirmed");
  const unpaidCount = countBillingSheetStatusFilter(rows, "unpaid");
  const paidCount = countBillingSheetStatusFilter(rows, "paid");
  const routeQuery = isAll ? "all" : activeRoute?.id ?? "all";

  function billingHref(extra?: Record<string, string>) {
    const p = new URLSearchParams();
    p.set("period", activePeriod.id);
    if (isSummary) p.set("view", "summary");
    else p.set("route", routeQuery);
    if (extra?.status !== undefined) {
      if (extra.status && extra.status !== "all") p.set("status", extra.status);
    } else if (statusFilter !== "all") {
      p.set("status", statusFilter);
    }
    const qTrim = searchQuery?.trim();
    if (qTrim) p.set("q", qTrim);
    return `/admin/billing-sheet?${p.toString()}`;
  }

  const statusTabs: { key: BillingSheetStatusFilter; label: string }[] = [
    { key: "all", label: "Tất cả" },
    { key: "pending", label: pendingCount ? `Chờ chốt (${pendingCount})` : "Chờ chốt" },
    { key: "confirmed", label: confirmedCount ? `Đã chốt (${confirmedCount})` : "Đã chốt" },
    { key: "unpaid", label: unpaidCount ? `Chưa thu (${unpaidCount})` : "Chưa thu" },
    { key: "paid", label: paidCount ? `Đã thu (${paidCount})` : "Đã thu" },
  ];

  return (
    <div className="billing-sheet-page">
      {(imported || paid || errors) && (
        <div className="card mb-3 border-[var(--primary)]/30 bg-[var(--primary-soft)]/35 py-3 text-sm">
          Đã xử lý Excel: cập nhật CSM <strong>{imported ?? 0}</strong> · Đã thu{" "}
          <strong>{paid ?? 0}</strong> · Lỗi <strong>{errors ?? 0}</strong>
          {durationMs && (
            <span className="text-[var(--muted)]">
              {" "}
              · {(Number(durationMs) / 1000).toFixed(1)}s
            </span>
          )}
          {message && <span className="text-[var(--warning)]"> — {message}</span>}
        </div>
      )}

      {/* Hàng 1: Tiêu đề */}
      <div className="mb-2">
        <h1 className="text-xl font-bold sm:text-2xl">Bảng thu nước</h1>
        <p className="text-sm text-[var(--muted)]">
          Kỳ <strong>{periodLabel}</strong>
          {isAll
            ? " — tất cả hộ"
            : isSummary
              ? " — tổng theo khu vực"
              : activeRoute
                ? ` — ${activeRoute.name}`
                : ""}
          {!isSummary && statusFilter !== "all" && (
            <span>
              {" "}
              · hiển thị{" "}
              <strong>{countBillingSheetStatusFilter(rows, statusFilter)}</strong>
              /{rows.length} hộ
            </span>
          )}
        </p>
      </div>

      {/* Hàng 2: Bộ lọc + In PDF + Excel */}
      <BillingPrintSelectionProvider>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="billing-mobile-filter-panel flex flex-wrap items-end gap-2 max-md:w-full max-md:flex-col max-md:items-stretch max-md:gap-2">
            <Suspense fallback={null}>
              <BillingPeriodSelect
                periods={periods.map((p) => ({
                  id: p.id,
                  label: `${formatPeriod(p.month, p.year)}${p.status === "OPEN" ? " (đang thu)" : ""}`,
                }))}
                activePeriodId={activePeriod.id}
                routeId={isSummary ? undefined : routeQuery}
                isSummary={isSummary}
              />
              <BillingRouteSelect
                periodId={activePeriod.id}
                routes={routes.map((r) => ({ id: r.id, name: r.name }))}
                activeRouteId={isAll ? null : activeRoute?.id ?? null}
                isSummary={isSummary}
              />
            </Suspense>
            {!isSummary && (
              <BillingSheetSearchControl
                key={searchQuery ?? ""}
                initialQuery={searchQuery ?? ""}
              />
            )}
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {!isSummary && (
              <div className="hidden md:block">
                <BillingPrintPanel
                  key={`desktop-print-${searchQuery ?? ""}`}
                  periodId={activePeriod.id}
                  initialSearchQuery={searchQuery ?? ""}
                  rows={rows.map((r) => ({
                    householdId: r.householdId,
                    householdCode: r.householdCode,
                    meterCode: r.meterCode,
                    residentName: r.residentName,
                    address: r.address,
                    contactPhone: r.contactPhone,
                    routeName: r.routeName,
                    status: r.status,
                  }))}
                />
              </div>
            )}
            <div className="hidden md:block">
              <BillingExcelPanel periodId={activePeriod.id} />
            </div>
          </div>
        </div>

        {!isSummary && (activeRoute || isAll) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {statusTabs.map((tab) => {
            const href = billingHref({ status: tab.key });
            const active = statusFilter === tab.key;
            return (
              <Link
                key={tab.key}
                href={href}
                className={[
                  "rounded-lg px-3 py-1.5 text-sm font-medium",
                  active
                    ? "bg-[var(--primary)] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-[var(--primary-soft)]",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        )}

        {isSummary ? (
        <BillingSheetSummary summaries={summaries} periodLabel={periodLabel} />
      ) : activeRoute || isAll ? (
        <BillingSheetGrid
          key={`${activePeriod.id}-${routeQuery}-${statusFilter}`}
          periodId={activePeriod.id}
          rows={rows}
          statusFilter={statusFilter}
          initialSearchQuery={searchQuery ?? ""}
          vatPercent={vatPercent}
          showRoute={isAll}
          allowPaidEdit
          allowCscEdit
        />
        ) : (
          <p className="text-[var(--muted)]">
            Chưa có khu vực thu.{" "}
            <Link href="/admin/households" className="text-[var(--primary)] hover:underline">
              Gán hộ vào khu vực
            </Link>
          </p>
        )}

        <div className="mt-4 space-y-2 md:hidden">
          {!isSummary && (
            <BillingPrintPanel
              key={`mobile-print-${searchQuery ?? ""}`}
              periodId={activePeriod.id}
              initialSearchQuery={searchQuery ?? ""}
              rows={rows.map((r) => ({
                householdId: r.householdId,
                householdCode: r.householdCode,
                meterCode: r.meterCode,
                residentName: r.residentName,
                address: r.address,
                contactPhone: r.contactPhone,
                routeName: r.routeName,
                status: r.status,
              }))}
            />
          )}
          <BillingExcelPanel periodId={activePeriod.id} />
        </div>

        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          <Link href="/admin/routes" className="hover:underline">
            Sửa khu vực thu (tuyến)
          </Link>
          {" · "}
          Tick chọn hàng · <strong>In hàng loạt</strong> hoặc cột <strong>Hóa đơn</strong> từng hộ
        </p>
      </BillingPrintSelectionProvider>
    </div>
  );
}
