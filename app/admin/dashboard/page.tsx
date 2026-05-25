import Link from "next/link";
import { InvoiceStatus, ReadingStatus } from "@/lib/types/enums";;
import { formatCurrency } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { getCurrentPeriodProgress } from "@/lib/routeProgress";
import { formatPeriod, periodStatusLabel } from "@/lib/vi";

export default async function AdminDashboardPage() {
  const progress = await getCurrentPeriodProgress();

  if (!progress) {
    return (
      <div className="card">
        <h1 className="mb-2 text-2xl font-bold">Tổng quan thu tiền nước</h1>
        <p className="text-sm text-[var(--muted)]">
          Chưa có kỳ thu. Hãy tạo kỳ trong database hoặc chạy seed trước khi vận hành.
        </p>
      </div>
    );
  }

  const periodId = progress.period.id;
  const [
    confirmedReadings,
    rejectedReadings,
    invoiceCount,
    issuedInvoices,
    paidInvoices,
    missingPdf,
    invoiceTotal,
    paidTotal,
    waterUsage,
  ] = await Promise.all([
    prisma.meterReading.count({
      where: { periodId, status: ReadingStatus.CONFIRMED },
    }),
    prisma.meterReading.count({
      where: { periodId, status: ReadingStatus.REJECTED },
    }),
    prisma.invoice.count({ where: { periodId } }),
    prisma.invoice.count({
      where: { periodId, status: InvoiceStatus.ISSUED },
    }),
    prisma.invoice.count({
      where: { periodId, status: InvoiceStatus.PAID },
    }),
    prisma.invoice.count({
      where: { periodId, pdfPath: null },
    }),
    prisma.invoice.aggregate({
      where: { periodId },
      _sum: { totalAmount: true },
    }),
    prisma.invoice.aggregate({
      where: { periodId, status: InvoiceStatus.PAID },
      _sum: { totalAmount: true },
    }),
    loadMonthlyWaterUsage({
      id: progress.period.id,
      year: progress.period.year,
      month: progress.period.month,
    }),
  ]);

  const missingReadings = Math.max(0, progress.totalActive - progress.withReading);
  const remainingMoney = Math.max(
    0,
    (invoiceTotal._sum.totalAmount ?? 0) - (paidTotal._sum.totalAmount ?? 0)
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tổng quan thu tiền nước</h1>
          <p className="text-sm text-[var(--muted)]">
            {formatPeriod(progress.period.month, progress.period.year)} —{" "}
            {periodStatusLabel(progress.period.status)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/billing-sheet?route=all&status=pending" className="btn btn-primary">
            Xử lý chờ chốt
          </Link>
          <Link href="/admin/billing-sheet?route=all" className="btn btn-secondary">
            Mở bảng thu
          </Link>
        </div>
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Đã có CSM"
          value={`${progress.withReading}/${progress.totalActive}`}
          hint={`${progress.percent}% hộ đang sử dụng`}
          tone="mint"
        />
        <MetricCard
          label="Chờ chốt"
          value={progress.pending}
          hint={missingReadings > 0 ? `${missingReadings} hộ chưa ghi` : "Đã ghi đủ hộ"}
          tone="yellow"
        />
        <MetricCard
          label="Hóa đơn"
          value={invoiceCount}
          hint={`${missingPdf} hóa đơn chưa có PDF`}
          tone="blue"
        />
        <MetricCard
          label="Đã thu"
          value={formatCurrency(paidTotal._sum.totalAmount ?? 0)}
          hint={`Còn ${formatCurrency(remainingMoney)}`}
          tone="pink"
        />
      </section>

      <section className="card mb-6">
        <h2 className="mb-3 text-lg font-bold">Khu vực thu</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {progress.routeProgress.map((route) => {
            const percent =
              route.total > 0 ? Math.round((route.recorded / route.total) * 100) : 0;
            return (
              <Link
                key={route.routeId}
                href={`/admin/billing-sheet?route=${route.routeId}`}
                className="block rounded-lg border border-[var(--border)] bg-[var(--card-muted)] px-3 py-2 hover:bg-[var(--primary-soft)]/45"
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold">{route.routeName}</span>
                  <span className="text-[var(--muted)]">{percent}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[var(--primary)]"
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {route.recorded}/{route.total} đã ghi, còn {route.missing}
                </p>
              </Link>
            );
          })}
          {!progress.routeProgress.length && (
            <p className="text-sm text-[var(--muted)] sm:col-span-2 lg:col-span-3 xl:col-span-4">
              Chưa có tuyến thu. Tạo tuyến và gán hộ tại{" "}
              <Link href="/admin/routes" className="text-[var(--primary)] hover:underline">
                quản lý tuyến
              </Link>
              .
            </p>
          )}
        </div>
      </section>

      <WaterUsageDashboard data={waterUsage} />

      <section className="card mb-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Checklist vận hành tháng</h2>
            <p className="text-sm text-[var(--muted)]">
              Đi theo thứ tự này để tránh tạo hóa đơn khi chưa chốt CSM.
            </p>
          </div>
          <span className="badge bg-[var(--primary-soft)] text-[var(--primary-dark)]">
            {formatPeriod(progress.period.month, progress.period.year)}
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <WorkflowStep
            number="1"
            title="Ghi chỉ số"
            body="Hộ dân gửi CSM, nhân viên có thể nhập trực tiếp trên bảng tuyến."
            href="/admin/billing-sheet?route=all"
            cta="Mở bảng ghi"
            status={
              progress.pending > 0
                ? `${progress.pending} chờ chốt`
                : missingReadings > 0
                  ? `${missingReadings} chưa ghi`
                  : "Hoàn tất"
            }
          />
          <WorkflowStep
            number="2"
            title="Chốt chỉ số"
            body="Xem ảnh nếu có, chốt hoặc từ chối chỉ số hộ dân đã gửi."
            href="/admin/billing-sheet?route=all&status=pending"
            cta="Xem chờ chốt"
            status={`${confirmedReadings} đã xác nhận, ${rejectedReadings} từ chối`}
          />
          <WorkflowStep
            number="3"
            title="Hóa đơn PDF"
            body="Trên Bảng thu nước: chốt CSM → bấm「Hóa đơn」từng hộ để tạo/xem PDF."
            href="/admin/billing-sheet?route=all"
            cta="Mở bảng thu"
            status={`${issuedInvoices} chưa TT · ${missingPdf} chưa có PDF`}
          />
          <WorkflowStep
            number="4"
            title="Thu tiền & khóa sổ"
            body="Đánh dấu đã thu, tải Excel kỳ này rồi đóng kỳ khi hoàn tất."
            href="/admin/payments"
            cta="Xác nhận thu"
            status={`${paidInvoices} hóa đơn đã thu`}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <QuickLink
          title="Danh sách hộ"
          body="Tra cứu hộ dân, đồng hồ, tuyến và lịch sử chỉ số."
          href="/admin/households"
        />
        <QuickLink
          title="Tải Excel"
          body="Xuất sổ thu theo kỳ hoặc dữ liệu tổng hợp cho kế toán."
          href="/admin/export"
        />
        <QuickLink
          title="Tài liệu vận hành"
          body="Quy trình tháng: ghi số, hóa đơn, thu tiền, đóng kỳ."
          href="/admin/operations"
        />
      </section>
    </>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: "mint" | "yellow" | "blue" | "pink";
}) {
  const tones = {
    mint: "border-emerald-100 bg-emerald-50/60 text-[var(--primary-dark)]",
    yellow: "border-amber-100 bg-amber-50/60 text-amber-700",
    blue: "border-sky-100 bg-sky-50/60 text-sky-700",
    pink: "border-rose-100 bg-rose-50/60 text-rose-700",
  };

  return (
    <div className={`card border ${tones[tone]}`}>
      <p className="text-sm font-semibold text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}

function WorkflowStep({
  number,
  title,
  body,
  href,
  cta,
  status,
}: {
  number: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  status: string;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-[var(--border)] bg-white p-3 sm:grid-cols-[2rem_1fr_auto] sm:items-center">
      <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--primary-soft)] text-sm font-bold text-[var(--primary-dark)]">
        {number}
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{title}</h3>
          <span className="badge bg-slate-100 text-slate-600">{status}</span>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
      </div>
      <Link href={href} className="btn btn-secondary py-1.5 text-sm">
        {cta}
      </Link>
    </div>
  );
}

function QuickLink({
  title,
  body,
  href,
}: {
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link href={href} className="card block hover:border-[var(--primary)]/40">
      <h2 className="font-bold">{title}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
    </Link>
  );
}

type UsagePeriod = {
  id: string;
  year: number;
  month: number;
};

type MonthlyUsageRow = {
  periodId: string;
  label: string;
  totalM3: number;
  confirmedCount: number;
  averageM3: number;
  totalChangePercent: number | null;
  averageChangePercent: number | null;
  risk: "high" | "watch" | "normal";
};

type RouteLeakAlert = {
  routeId: string | null;
  routeName: string;
  currentTotalM3: number;
  previousTotalM3: number;
  currentAverageM3: number;
  previousAverageM3: number;
  totalChangePercent: number;
  averageChangePercent: number;
};

type MonthlyWaterUsage = {
  current: MonthlyUsageRow | null;
  previous: MonthlyUsageRow | null;
  rows: MonthlyUsageRow[];
  maxTotalM3: number;
  routeAlerts: RouteLeakAlert[];
};

async function loadMonthlyWaterUsage(activePeriod: UsagePeriod): Promise<MonthlyWaterUsage> {
  const periods = (
    await prisma.billingPeriod.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 12,
      select: { id: true, year: true, month: true },
    })
  ).reverse();

  const periodIds = periods.map((p) => p.id);
  const usageGroups = periodIds.length
    ? await prisma.meterReading.groupBy({
        by: ["periodId"],
        where: {
          periodId: { in: periodIds },
          status: ReadingStatus.CONFIRMED,
          usageM3: { not: null },
        },
        _sum: { usageM3: true },
        _count: { id: true },
      })
    : [];

  const usageByPeriod = new Map(
    usageGroups.map((g) => [
      g.periodId,
      {
        totalM3: g._sum.usageM3 ?? 0,
        confirmedCount: g._count.id,
      },
    ])
  );

  const rows: MonthlyUsageRow[] = [];
  for (const period of periods) {
    const usage = usageByPeriod.get(period.id) ?? { totalM3: 0, confirmedCount: 0 };
    const previous = rows.at(-1);
    const averageM3 =
      usage.confirmedCount > 0 ? usage.totalM3 / usage.confirmedCount : 0;
    const totalChangePercent = previous
      ? percentChange(usage.totalM3, previous.totalM3)
      : null;
    const averageChangePercent = previous
      ? percentChange(averageM3, previous.averageM3)
      : null;

    rows.push({
      periodId: period.id,
      label: `T${period.month}/${period.year}`,
      totalM3: usage.totalM3,
      confirmedCount: usage.confirmedCount,
      averageM3,
      totalChangePercent,
      averageChangePercent,
      risk: classifyUsageRisk({
        currentTotal: usage.totalM3,
        previousTotal: previous?.totalM3 ?? 0,
        currentCount: usage.confirmedCount,
        previousCount: previous?.confirmedCount ?? 0,
        totalChangePercent,
        averageChangePercent,
      }),
    });
  }

  const current = rows.find((r) => r.periodId === activePeriod.id) ?? rows.at(-1) ?? null;
  const previous = current
    ? rows.slice(0, rows.findIndex((r) => r.periodId === current.periodId)).at(-1) ?? null
    : null;

  const routeAlerts =
    current && previous
      ? await loadRouteLeakAlerts({
          currentPeriodId: current.periodId,
          previousPeriodId: previous.periodId,
        })
      : [];

  return {
    current,
    previous,
    rows,
    maxTotalM3: Math.max(1, ...rows.map((r) => r.totalM3)),
    routeAlerts,
  };
}

async function loadRouteLeakAlerts({
  currentPeriodId,
  previousPeriodId,
}: {
  currentPeriodId: string;
  previousPeriodId: string;
}): Promise<RouteLeakAlert[]> {
  const readings = await prisma.meterReading.findMany({
    where: {
      periodId: { in: [currentPeriodId, previousPeriodId] },
      status: ReadingStatus.CONFIRMED,
      usageM3: { not: null },
    },
    select: {
      periodId: true,
      usageM3: true,
      household: {
        select: {
          collectionRouteId: true,
          collectionRoute: { select: { name: true } },
        },
      },
    },
  });

  const buckets = new Map<
    string,
    {
      routeId: string | null;
      routeName: string;
      currentTotalM3: number;
      previousTotalM3: number;
      currentCount: number;
      previousCount: number;
    }
  >();

  for (const reading of readings) {
    const routeId = reading.household.collectionRouteId;
    const key = routeId ?? "unassigned";
    const bucket =
      buckets.get(key) ??
      {
        routeId,
        routeName: reading.household.collectionRoute?.name ?? "Chưa gán khu vực",
        currentTotalM3: 0,
        previousTotalM3: 0,
        currentCount: 0,
        previousCount: 0,
      };

    if (reading.periodId === currentPeriodId) {
      bucket.currentTotalM3 += reading.usageM3 ?? 0;
      bucket.currentCount++;
    } else {
      bucket.previousTotalM3 += reading.usageM3 ?? 0;
      bucket.previousCount++;
    }

    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .map((bucket) => {
      const currentAverageM3 =
        bucket.currentCount > 0 ? bucket.currentTotalM3 / bucket.currentCount : 0;
      const previousAverageM3 =
        bucket.previousCount > 0 ? bucket.previousTotalM3 / bucket.previousCount : 0;
      return {
        routeId: bucket.routeId,
        routeName: bucket.routeName,
        currentTotalM3: bucket.currentTotalM3,
        previousTotalM3: bucket.previousTotalM3,
        currentAverageM3,
        previousAverageM3,
        totalChangePercent: percentChange(bucket.currentTotalM3, bucket.previousTotalM3) ?? 0,
        averageChangePercent: percentChange(currentAverageM3, previousAverageM3) ?? 0,
        countRatio:
          bucket.previousCount > 0 ? bucket.currentCount / bucket.previousCount : 1,
      };
    })
    .filter((route) => {
      const totalIncrease = route.currentTotalM3 - route.previousTotalM3;
      return (
        route.countRatio >= 0.75 &&
        totalIncrease >= 20 &&
        (route.totalChangePercent >= 25 || route.averageChangePercent >= 25)
      );
    })
    .sort((a, b) => b.totalChangePercent - a.totalChangePercent)
    .slice(0, 5)
    .map((route) => ({
      routeId: route.routeId,
      routeName: route.routeName,
      currentTotalM3: route.currentTotalM3,
      previousTotalM3: route.previousTotalM3,
      currentAverageM3: route.currentAverageM3,
      previousAverageM3: route.previousAverageM3,
      totalChangePercent: route.totalChangePercent,
      averageChangePercent: route.averageChangePercent,
    }));
}

function WaterUsageDashboard({ data }: { data: MonthlyWaterUsage }) {
  const current = data.current;
  const previous = data.previous;
  const currentDelta =
    current?.totalChangePercent == null ? "Chưa đủ dữ liệu" : formatPercent(current.totalChangePercent);
  const alertCount = data.routeAlerts.length;

  return (
    <section className="card mb-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Tổng lượng nước theo tháng</h2>
          <p className="text-sm text-[var(--muted)]">
            Dựa trên CSM đã chốt, dùng để phát hiện tăng bất thường hoặc nghi rò rỉ.
          </p>
        </div>
        <span
          className={`badge ${
            alertCount
              ? "bg-amber-100 text-amber-700"
              : "bg-[var(--primary-soft)] text-[var(--primary-dark)]"
          }`}
        >
          {alertCount ? `${alertCount} khu vực cần xem` : "Chưa thấy tăng bất thường"}
        </span>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card-muted)] p-3">
          <p className="text-xs font-semibold uppercase text-[var(--muted)]">Tháng hiện tại</p>
          <p className="mt-1 text-2xl font-bold">
            {current ? formatM3(current.totalM3) : "—"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {current ? `${current.confirmedCount} hộ đã chốt CSM` : "Chưa có dữ liệu"}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-white p-3">
          <p className="text-xs font-semibold uppercase text-[var(--muted)]">So với tháng trước</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              current?.risk === "high"
                ? "text-rose-600"
                : current?.risk === "watch"
                  ? "text-amber-600"
                  : "text-[var(--primary-dark)]"
            }`}
          >
            {currentDelta}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {previous ? `Tháng trước ${formatM3(previous.totalM3)}` : "Cần ít nhất 2 kỳ"}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-white p-3">
          <p className="text-xs font-semibold uppercase text-[var(--muted)]">Bình quân / hộ</p>
          <p className="mt-1 text-2xl font-bold">
            {current ? formatM3(current.averageM3) : "—"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {current?.averageChangePercent == null
              ? "Chưa đủ dữ liệu so sánh"
              : `${formatPercent(current.averageChangePercent)} so với tháng trước`}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-2">
          {data.rows.map((row) => {
            const width = Math.max(2, Math.round((row.totalM3 / data.maxTotalM3) * 100));
            return (
              <Link
                key={row.periodId}
                href={`/admin/billing-sheet?period=${row.periodId}&route=all`}
                className="grid gap-2 rounded-lg px-2 py-2 hover:bg-[var(--card-muted)] sm:grid-cols-[5rem_1fr_8rem] sm:items-center"
              >
                <div className="text-sm font-semibold">{row.label}</div>
                <div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        row.risk === "high"
                          ? "bg-rose-500"
                          : row.risk === "watch"
                            ? "bg-amber-500"
                            : "bg-[var(--primary)]"
                      }`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {row.confirmedCount} hộ · bình quân {formatM3(row.averageM3)}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-bold">{formatM3(row.totalM3)}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {row.totalChangePercent == null
                      ? "—"
                      : formatPercent(row.totalChangePercent)}
                  </p>
                </div>
              </Link>
            );
          })}
          {!data.rows.length && (
            <p className="rounded-lg bg-[var(--card-muted)] p-3 text-sm text-[var(--muted)]">
              Chưa có dữ liệu chỉ số đã chốt để lập biểu đồ.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--card-muted)] p-3">
          <h3 className="font-semibold">Khu vực nghi rò rỉ</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Tăng mạnh so với tháng trước khi số hộ ghi tương đương.
          </p>
          <div className="mt-3 space-y-2">
            {data.routeAlerts.map((route) => (
              <Link
                key={route.routeId ?? route.routeName}
                href={
                  route.routeId
                    ? `/admin/billing-sheet?period=${current?.periodId ?? ""}&route=${route.routeId}`
                    : `/admin/billing-sheet?period=${current?.periodId ?? ""}&route=all`
                }
                className="block rounded-lg border border-amber-200 bg-white px-3 py-2 hover:bg-amber-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{route.routeName}</span>
                  <span className="text-sm font-bold text-amber-700">
                    +{route.totalChangePercent}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {formatM3(route.previousTotalM3)} → {formatM3(route.currentTotalM3)} · bình quân{" "}
                  {formatM3(route.currentAverageM3)}/hộ
                </p>
              </Link>
            ))}
            {!data.routeAlerts.length && (
              <p className="rounded-lg bg-white p-3 text-sm text-[var(--muted)]">
                Chưa có khu vực nào tăng vượt ngưỡng cảnh báo.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function classifyUsageRisk({
  currentTotal,
  previousTotal,
  currentCount,
  previousCount,
  totalChangePercent,
  averageChangePercent,
}: {
  currentTotal: number;
  previousTotal: number;
  currentCount: number;
  previousCount: number;
  totalChangePercent: number | null;
  averageChangePercent: number | null;
}): MonthlyUsageRow["risk"] {
  if (totalChangePercent == null) return "normal";
  const countRatio = previousCount > 0 ? currentCount / previousCount : 1;
  const totalIncrease = currentTotal - previousTotal;
  if (countRatio < 0.75) return "normal";
  if (
    totalIncrease >= 50 &&
    (totalChangePercent >= 30 || (averageChangePercent ?? 0) >= 30)
  ) {
    return "high";
  }
  if (
    totalIncrease >= 30 &&
    (totalChangePercent >= 15 || (averageChangePercent ?? 0) >= 15)
  ) {
    return "watch";
  }
  return "normal";
}

function formatM3(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString("vi-VN")} m³`;
}

function formatPercent(value: number): string {
  return `${value > 0 ? "+" : ""}${value}%`;
}
