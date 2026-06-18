import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  buildHouseholdPeriodTimeline,
  householdTimelineStats,
  splitTimelineByPeriodStatus,
} from "@/lib/householdPeriod";
import { HouseholdPeriodPanel } from "@/components/HouseholdPeriodPanel";
import { householdInactiveFromLabel, householdStatusLabel } from "@/lib/vi";
import { updateHouseholdPaymentMethod } from "../actions";
import { DeleteHouseholdButton } from "./DeleteHouseholdButton";
import { HouseholdStatusActions } from "./HouseholdStatusActions";
import { PaymentMethod } from "@prisma/client";

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
};

export default async function HouseholdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [household, allPeriods] = await Promise.all([
    prisma.household.findUnique({
      where: { id },
      include: {
        collectionRoute: { select: { name: true, unitPrice: true } },
        user: { select: { id: true, phone: true, name: true } },
        readings: { include: { period: true } },
        invoices: {
          include: { period: true, payment: true },
        },
        notifications: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    }),
    prisma.billingPeriod.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),
  ]);

  if (!household) notFound();

  const timeline = buildHouseholdPeriodTimeline(
    allPeriods,
    household.readings,
    household.invoices
  );
  const { open: openPeriods, closed: closedPeriods } = splitTimelineByPeriodStatus(timeline);
  const stats = householdTimelineStats(timeline);
  const phone = household.contactPhone ?? household.user?.phone;
  const inactiveFromLabel = householdInactiveFromLabel(
    household.inactiveFromYear,
    household.inactiveFromMonth
  );

  return (
    <>
      <div className="mb-4">
        <Link href="/admin/households" className="text-sm text-[var(--primary)] hover:underline">
          ← Danh sách hộ dân
        </Link>
      </div>

      {/* 1. Định danh hộ */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Hồ sơ hộ dân
          </p>
          <h1 className="text-2xl font-bold">
            {household.householdCode} — {household.residentName}
          </h1>
          <p className="text-sm text-[var(--muted)]">{household.address}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge bg-[var(--primary-soft)] text-[var(--primary-dark)]">
            Đồng hồ {household.meterCode}
          </span>
          <span
            className={[
              "badge",
              household.status === "ACTIVE"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-amber-50 text-amber-900",
            ].join(" ")}
          >
            {householdStatusLabel(household.status)}
          </span>
          {inactiveFromLabel && (
            <span className="badge bg-amber-50 text-amber-900">{inactiveFromLabel}</span>
          )}
          {household.collectionRoute && (
            <span className="badge bg-slate-100 text-slate-700">{household.collectionRoute.name}</span>
          )}
          <HouseholdStatusActions
            householdId={household.id}
            householdCode={household.householdCode}
            residentName={household.residentName}
            status={household.status}
            inactiveFromLabel={inactiveFromLabel}
          />
          <DeleteHouseholdButton
            householdId={household.id}
            householdCode={household.householdCode}
            residentName={household.residentName}
          />
        </div>
      </header>

      {/* 2. KPI nhanh */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Kỳ đã ghi chỉ số" value={String(stats.periodCount)} />
        <Kpi
          label="Chờ duyệt"
          value={String(stats.pendingReadings)}
          highlight={stats.pendingReadings > 0}
        />
        <Kpi
          label="HĐ chưa TT"
          value={String(stats.unpaidCount)}
          sub={stats.unpaidTotal > 0 ? formatMoney(stats.unpaidTotal) : undefined}
          highlight={stats.unpaidCount > 0}
        />
        <Kpi
          label="TB tiêu thụ (gần nhất)"
          value={stats.avgUsage3 != null ? `${stats.avgUsage3.toFixed(1)} m³` : "—"}
        />
        <Kpi
          label="Chỉ số cuối"
          value={stats.latestConfirmed != null ? String(stats.latestConfirmed) : "—"}
        />
      </div>

      {/* 3. Thông tin tĩnh */}
      <section className="card mb-8">
        <h2 className="mb-4 text-lg font-semibold">Thông tin hộ</h2>
        <div className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <InfoItem label="Mã hộ" value={household.householdCode} mono />
          <InfoItem label="Mã đồng hồ" value={household.meterCode} mono />
          <InfoItem label="Khu vực" value={household.collectionRoute?.name ?? "—"} />
          <InfoItem
            label="Đơn giá"
            value={household.collectionRoute?.unitPrice != null
              ? `${household.collectionRoute.unitPrice.toLocaleString("vi-VN")} đ/m³`
              : "—"}
          />
          <InfoItem label="Liên hệ" value={phone ?? "—"} />
          <InfoItem label="Tài khoản app" value={household.user?.phone ?? "Chưa gắn"} />
          <InfoItem
            label="Ngày tạo hồ sơ"
            value={household.createdAt.toLocaleDateString("vi-VN")}
          />
          <InfoItem
            label="Trạng thái sử dụng"
            value={
              inactiveFromLabel
                ? `${householdStatusLabel(household.status)} — ${inactiveFromLabel}`
                : householdStatusLabel(household.status)
            }
          />
          <InfoItem label="Ghi chú" value={household.note?.trim() || "—"} className="sm:col-span-2" />
          <div>
            <p className="text-xs font-medium text-[var(--muted)]">Hình thức thu tiền</p>
            <form
              action={updateHouseholdPaymentMethod.bind(null, household.id)}
              className="mt-1 flex items-center gap-2"
            >
              <select
                name="paymentMethod"
                defaultValue={household.paymentMethod}
                className="input py-1 text-sm"
              >
                <option value="CASH">Tiền mặt</option>
                <option value="BANK_TRANSFER">Chuyển khoản</option>
              </select>
              <button type="submit" className="btn btn-secondary py-1 text-xs">
                Lưu
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* 4. Timeline theo kỳ — accordion */}
      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold">Lịch sử theo từng tháng (kỳ ghi)</h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Bấm từng dòng để mở chi tiết chỉ số, hóa đơn và thanh toán của kỳ đó. Kỳ{" "}
          <strong>đã đóng</strong> là các tháng BQL đã chốt (trạng thái kỳ trên hệ thống).
        </p>

        {openPeriods.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-semibold text-[var(--primary-dark)]">
              Kỳ đang mở ({openPeriods.length})
            </h3>
            <div className="space-y-2">
              {openPeriods.map((row, i) => (
                <HouseholdPeriodPanel key={row.period.id} row={row} defaultOpen={i === 0} />
              ))}
            </div>
          </div>
        )}

        {closedPeriods.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-600">
              Các kỳ đã đóng ({closedPeriods.length})
            </h3>
            <div className="space-y-2">
              {closedPeriods.map((row) => (
                <HouseholdPeriodPanel key={row.period.id} row={row} />
              ))}
            </div>
          </div>
        )}

        {!openPeriods.length && !closedPeriods.length && (
          <p className="card text-sm text-[var(--muted)]">Chưa có kỳ ghi nước trên hệ thống.</p>
        )}
      </section>

      {/* 5. Thông báo gần đây */}
      {household.notifications.length > 0 && (
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold">Thông báo gần đây</h2>
          <ul className="space-y-2 text-sm">
            {household.notifications.map((n) => (
              <li key={n.id} className="border-b border-slate-100 pb-2 last:border-0">
                <span className="font-medium">{n.title}</span>
                <p className="text-[var(--muted)]">{n.message}</p>
                <span className="text-xs text-slate-400">
                  {n.createdAt.toLocaleString("vi-VN")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Kpi({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`card ${highlight ? "border-amber-200 bg-amber-50/40" : ""}`}
    >
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

function InfoItem({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      <p className={`mt-0.5 font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function formatMoney(n: number) {
  return `${n.toLocaleString("vi-VN")} đ`;
}
