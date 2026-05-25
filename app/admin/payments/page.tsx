import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/billing";
import { InvoiceStatus, PaymentMethod, Prisma } from "@prisma/client";
import { ConfirmPaymentButton } from "./ConfirmPaymentButton";
import { PaymentMethodSelect } from "./PaymentMethodSelect";
import { SendStatusBadge } from "./SendStatusBadge";
import { SendAllBankTransferButton } from "./SendInvoiceButton";
import { formatPeriod } from "@/lib/vi";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
};


export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; method?: string }>;
}) {
  const { q, page: pageParam, method: methodParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const pageSize = 50;
  const skip = (page - 1) * pageSize;
  const query = q?.trim();

  const methodFilter =
    methodParam === "CASH" || methodParam === "BANK_TRANSFER"
      ? (methodParam as PaymentMethod)
      : null;

  const householdFilter: Prisma.HouseholdWhereInput = {
    ...(query
      ? {
          OR: [
            { householdCode: { contains: query, mode: "insensitive" } },
            { meterCode: { contains: query, mode: "insensitive" } },
            { residentName: { contains: query, mode: "insensitive" } },
            { address: { contains: query, mode: "insensitive" } },
            { contactPhone: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(methodFilter ? { paymentMethod: methodFilter } : {}),
  };

  const hasHouseholdFilter = query || methodFilter;

  const where: Prisma.InvoiceWhereInput = {
    status: InvoiceStatus.ISSUED,
    ...(hasHouseholdFilter ? { household: householdFilter } : {}),
  };

  const [invoices, total, cashCount, bankCount] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        household: {
          include: { collectionRoute: { select: { name: true } } },
        },
        period: true,
        payment: true,
        sendLogs: { orderBy: { sentAt: "desc" }, take: 1, select: { sentAt: true } },
        _count: { select: { sendLogs: true } },
      },
      orderBy: [
        { household: { paymentMethod: "asc" } },
        { period: { year: "desc" } },
        { period: { month: "desc" } },
        { issuedAt: "desc" },
      ],
      skip,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.count({
      where: { status: InvoiceStatus.ISSUED, household: { paymentMethod: "CASH" } },
    }),
    prisma.invoice.count({
      where: { status: InvoiceStatus.ISSUED, household: { paymentMethod: "BANK_TRANSFER" } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(p: number, m?: string | null) {
    const params = new URLSearchParams();
    if (p > 1) params.set("page", String(p));
    if (query) params.set("q", query);
    if (m) params.set("method", m);
    const s = params.toString();
    return `/admin/payments${s ? `?${s}` : ""}`;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Xác nhận thanh toán</h1>
          <p className="text-sm text-[var(--muted)]">
            Hóa đơn chưa thu — tìm theo mã hộ, đồng hồ hoặc tên chủ hộ.
          </p>
        </div>
        <form className="flex gap-2" method="get">
          {methodFilter && <input type="hidden" name="method" value={methodFilter} />}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Tìm MKH, đồng hồ, tên hộ..."
            className="input min-w-[220px]"
          />
          <button type="submit" className="btn btn-secondary">
            Tìm
          </button>
          {(query || methodFilter) && (
            <Link href="/admin/payments" className="btn btn-secondary">
              Xóa lọc
            </Link>
          )}
        </form>
      </div>

      {/* Nút gửi hàng loạt — chỉ hiện khi có hóa đơn chuyển khoản */}
      {bankCount > 0 && invoices.length > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <span className="text-sm text-blue-700">
            <strong>{bankCount}</strong> hóa đơn chờ thu qua chuyển khoản
          </span>
          <SendAllBankTransferButton
            periodId={invoices.find((i) => i.household.paymentMethod === "BANK_TRANSFER")?.periodId ?? invoices[0].periodId}
          />
        </div>
      )}

      {/* Filter tabs */}
      <div className="mb-3 flex gap-2 text-sm">
        <Link
          href={pageHref(1, null)}
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            !methodFilter
              ? "bg-[var(--primary)] text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Tất cả ({cashCount + bankCount})
        </Link>
        <Link
          href={pageHref(1, "CASH")}
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            methodFilter === "CASH"
              ? "bg-amber-500 text-white"
              : "bg-amber-50 text-amber-700 hover:bg-amber-100"
          }`}
        >
          Tiền mặt ({cashCount})
        </Link>
        <Link
          href={pageHref(1, "BANK_TRANSFER")}
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            methodFilter === "BANK_TRANSFER"
              ? "bg-blue-600 text-white"
              : "bg-blue-50 text-blue-700 hover:bg-blue-100"
          }`}
        >
          Chuyển khoản ({bankCount})
        </Link>
      </div>

      <p className="mb-3 text-sm text-slate-600">
        {total} hóa đơn chờ xác nhận
        {query ? ` (lọc: "${query}")` : ""}
        {methodFilter ? ` · ${METHOD_LABEL[methodFilter]}` : ""} — trang {page}/{totalPages}
      </p>

      <div className="overflow-x-auto card p-0">
        <table className="table-modern">
          <thead className="border-b bg-slate-50/70 text-left text-sm">
            <tr>
              <th>Mã hộ</th>
              <th>Đồng hồ</th>
              <th>Chủ hộ</th>
              <th>Khu vực</th>
              <th>Kỳ</th>
              <th className="text-right">Số tiền</th>
              <th>Hình thức</th>
              <th>Trạng thái gửi</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const method = inv.household.paymentMethod as PaymentMethod;
              return (
                <tr key={inv.id} className="border-b text-sm">
                  <td className="font-mono font-semibold">
                    <Link
                      href={`/admin/households/${inv.householdId}`}
                      className="text-[var(--primary)] hover:underline"
                    >
                      {inv.household.householdCode}
                    </Link>
                  </td>
                  <td className="font-mono">{inv.household.meterCode}</td>
                  <td>
                    <div className="font-medium">{inv.household.residentName}</div>
                    <div className="max-w-[14rem] truncate text-xs text-[var(--muted)]">
                      {inv.household.address}
                    </div>
                    {inv.household.contactPhone && (
                      <div className="text-xs text-[var(--muted)]">
                        {inv.household.contactPhone}
                      </div>
                    )}
                  </td>
                  <td className="text-xs text-[var(--muted)]">
                    {inv.household.collectionRoute?.name ?? "—"}
                  </td>
                  <td>{formatPeriod(inv.period.month, inv.period.year)}</td>
                  <td className="text-right font-semibold tabular-nums">
                    {formatCurrency(inv.totalAmount)}
                  </td>
                  <td>
                    <PaymentMethodSelect householdId={inv.householdId} value={method} />
                  </td>
                  <td>
                    <SendStatusBadge
                      invoiceId={inv.id}
                      sendCount={inv._count.sendLogs}
                      lastSentAt={inv.sendLogs[0]?.sentAt ?? null}
                      paid={inv.status === InvoiceStatus.PAID}
                      isBankTransfer={method === "BANK_TRANSFER"}
                    />
                  </td>
                  <td>
                    <ConfirmPaymentButton invoiceId={inv.id} method={method} />
                  </td>
                </tr>
              );
            })}
            {!invoices.length && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-slate-500">
                  {query || methodFilter
                    ? "Không có hóa đơn chờ thu khớp điều kiện lọc."
                    : "Không có hóa đơn chờ xác nhận."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex gap-2">
          {page > 1 && (
            <Link href={pageHref(page - 1, methodParam)} className="btn btn-secondary">
              ← Trước
            </Link>
          )}
          {page < totalPages && (
            <Link href={pageHref(page + 1, methodParam)} className="btn btn-secondary">
              Sau →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
