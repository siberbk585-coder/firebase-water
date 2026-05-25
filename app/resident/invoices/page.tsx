import Link from "next/link";
import { requireResident } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/billing";
import { InvoiceStatus } from "@/lib/types/enums";;
import { formatPeriod, invoiceStatusLabel } from "@/lib/vi";

export default async function ResidentInvoicesPage() {
  const user = await requireResident();
  if (!user.householdId) {
    return <p>Chưa gắn hộ dân.</p>;
  }

  const invoices = await prisma.invoice.findMany({
    where: { householdId: user.householdId },
    include: { period: true, payment: true },
    orderBy: [{ period: { year: "desc" } }, { period: { month: "desc" } }],
  });

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Hóa đơn của tôi</h1>
      <div className="overflow-x-auto card p-0">
        <table className="table-modern">
          <thead className="border-b bg-slate-50/70 text-left">
            <tr>
              <th>Kỳ</th>
              <th>Tiêu thụ</th>
              <th>Tổng tiền</th>
              <th>Trạng thái / Thanh toán</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b">
                <td>{formatPeriod(inv.period.month, inv.period.year)}</td>
                <td>{inv.usageM3} m³</td>
                <td>{formatCurrency(inv.totalAmount)}</td>
                <td>
                  <span
                    className={`badge ${
                      inv.status === InvoiceStatus.PAID
                        ? "badge-success"
                        : inv.status === InvoiceStatus.ISSUED
                          ? "badge-warning"
                          : ""
                    }`}
                  >
                    {invoiceStatusLabel(inv.status)}
                  </span>
                  {inv.payment?.confirmedAt && (
                    <span className="mt-1 block text-xs text-[var(--muted)]">
                      Đã thanh toán{" "}
                      {inv.payment.confirmedAt.toLocaleDateString("vi-VN")}
                    </span>
                  )}
                  {!inv.payment && inv.status === InvoiceStatus.ISSUED && (
                    <span className="mt-1 block text-xs text-[var(--muted)]">
                      Chưa thanh toán — liên hệ Ban quản lý để nộp tiền
                    </span>
                  )}
                </td>
                <td>
                  {inv.pdfPath ? (
                    <Link
                      href={`/invoice/${inv.id}`}
                      className="font-medium text-[var(--primary)] hover:underline"
                    >
                      Xem hóa đơn
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {!invoices.length && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  Chưa có hóa đơn
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
