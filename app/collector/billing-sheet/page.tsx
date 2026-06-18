import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  currentCalendarPeriod,
  getBillingPeriods,
  getCollectionRoutes,
  loadBillingSheetRows,
} from "@/lib/billingSheet";
import { BillingSheetGrid } from "@/components/BillingSheetGrid";
import {
  countBillingSheetStatusFilter,
  parseBillingSheetStatusFilter,
  type BillingSheetStatusFilter,
} from "@/lib/billingSheetFilters";
import { BillingPeriodSelect } from "@/components/BillingPeriodSelect";
import { BillingRouteSelect } from "@/components/BillingRouteSelect";
import { BillingPrintPanel } from "@/components/BillingPrintPanel";
import { BillingSheetSearchControl } from "@/components/BillingSheetSearchControl";
import { BillingPrintSelectionProvider } from "@/components/billing-print-selection";
import { formatPeriod } from "@/lib/vi";
import { getVatPercent } from "@/lib/vatServer";
import { requireCollector } from "@/lib/guards";
import {
  filterRoutesForSession,
  getCollectorRouteIds,
  resolveCollectorRouteQuery,
} from "@/lib/collectorAccess";

const BASE_PATH = "/collector/billing-sheet";

export default async function CollectorBillingSheetPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    route?: string;
    status?: string;
    q?: string;
  }>;
}) {
  const session = await requireCollector();
  const { period: periodId, route: routeParam, q: searchQuery, status: statusParam } =
    await searchParams;
  const statusFilter = parseBillingSheetStatusFilter(statusParam);

  const allowedRouteIds = await getCollectorRouteIds(session.id);
  if (!allowedRouteIds.length) {
    return (
      <>
        <h1 className="text-2xl font-bold">Bảng thu nước</h1>
        <p className="mt-2 text-[var(--muted)]">
          Tài khoản chưa được gán khu vực thu. Liên hệ quản trị.
        </p>
      </>
    );
  }

  const [periods, allRoutes, vatPercent] = await Promise.all([
    getBillingPeriods(),
    getCollectionRoutes(),
    getVatPercent(),
  ]);

  const routes = filterRoutesForSession(session, allRoutes, allowedRouteIds);
  const resolvedRoute = resolveCollectorRouteQuery(session, routeParam, allowedRouteIds);

  if (resolvedRoute === "__denied__") {
    redirect(`${BASE_PATH}?period=${periodId ?? ""}&route=${allowedRouteIds[0]}`);
  }

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
        <p className="text-[var(--muted)]">Chưa có kỳ thu.</p>
      </>
    );
  }

  const isAll = resolvedRoute === null;
  const activeRoute = !isAll ? routes.find((r) => r.id === resolvedRoute) ?? null : null;
  const routeIdForLoad = isAll ? null : activeRoute?.id ?? allowedRouteIds[0]!;

  const rows = await loadBillingSheetRows(activePeriod.id, routeIdForLoad, {
    allowedRouteIds,
  });

  const periodLabel = formatPeriod(activePeriod.month, activePeriod.year);
  const routeQuery: string = isAll ? "all" : (routeIdForLoad ?? allowedRouteIds[0]!);
  const showAllOption = allowedRouteIds.length > 1;
  const showRoutePicker = routes.length > 1;

  const pendingCount = countBillingSheetStatusFilter(rows, "pending");
  const confirmedCount = countBillingSheetStatusFilter(rows, "confirmed");
  const unpaidCount = countBillingSheetStatusFilter(rows, "unpaid");
  const paidCount = countBillingSheetStatusFilter(rows, "paid");

  function billingHref(extra?: Record<string, string>) {
    const p = new URLSearchParams();
    p.set("period", activePeriod.id);
    p.set("route", routeQuery);
    if (extra?.status !== undefined) {
      if (extra.status && extra.status !== "all") p.set("status", extra.status);
    } else if (statusFilter !== "all") {
      p.set("status", statusFilter);
    }
    const qTrim = searchQuery?.trim();
    if (qTrim) p.set("q", qTrim);
    return `${BASE_PATH}?${p.toString()}`;
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
      <div className="mb-2">
        <h1 className="text-xl font-bold sm:text-2xl">Bảng thu nước</h1>
        <p className="text-sm text-[var(--muted)]">
          Kỳ <strong>{periodLabel}</strong>
          {isAll
            ? " — các khu vực được gán"
            : activeRoute
              ? ` — ${activeRoute.name}`
              : ""}
        </p>
      </div>

      <BillingPrintSelectionProvider>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="billing-mobile-filter-panel flex flex-wrap items-end gap-2 max-md:w-full max-md:flex-col max-md:items-stretch">
            <Suspense fallback={null}>
              <BillingPeriodSelect
                periods={periods.map((p) => ({
                  id: p.id,
                  label: `${formatPeriod(p.month, p.year)}${p.status === "OPEN" ? " (đang thu)" : ""}`,
                }))}
                activePeriodId={activePeriod.id}
                routeId={routeQuery}
                basePath={BASE_PATH}
              />
              {showRoutePicker && (
                <BillingRouteSelect
                  periodId={activePeriod.id}
                  routes={routes.map((r) => ({ id: r.id, name: r.name }))}
                  activeRouteId={isAll ? null : activeRoute?.id ?? null}
                  isSummary={false}
                  basePath={BASE_PATH}
                  showAllOption={showAllOption}
                  showSummaryOption={false}
                />
              )}
            </Suspense>
            <BillingSheetSearchControl key={searchQuery ?? ""} initialQuery={searchQuery ?? ""} />
          </div>
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
        </div>

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

        <BillingSheetGrid
          key={`${activePeriod.id}-${routeQuery}-${statusFilter}`}
          periodId={activePeriod.id}
          rows={rows}
          statusFilter={statusFilter}
          initialSearchQuery={searchQuery ?? ""}
          vatPercent={vatPercent}
          showRoute={isAll}
        />

        <div className="mt-4 md:hidden">
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
        </div>
      </BillingPrintSelectionProvider>
    </div>
  );
}
