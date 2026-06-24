import Link from "next/link";
import { prisma } from "@/lib/db";
import { excludeSandboxRoutesWhere } from "@/lib/sandboxRoutes";
import { formatCurrency } from "@/lib/billing";
import { getSystemSettings } from "@/lib/settings";
import {
  calculateBillingAmounts,
  unitPriceExclusiveFromInclusive,
} from "@/lib/vat";
import { createRouteWithPrice, saveRoutePrices, saveVatSettings } from "./actions";

export default async function AreaPricesPage() {
  const [routes, settings] = await Promise.all([
    prisma.collectionRoute.findMany({
      where: excludeSandboxRoutesWhere(),
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { households: true } } },
    }),
    getSystemSettings(),
  ]);

  const defaultPrice =
    routes.find((r) => r.unitPrice != null)?.unitPrice ??
    (await prisma.priceGroup.findFirst({ orderBy: { code: "asc" } }))?.unitPrice ??
    15000;

  const vatPercent = settings.vatPercent;
  const vatSample = calculateBillingAmounts(10, defaultPrice, vatPercent);
  const unitOnReceipt = unitPriceExclusiveFromInclusive(defaultPrice, vatPercent);

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Giá khu vực &amp; thuế VAT</h1>
        <p className="text-sm text-[var(--muted)]">
          Đơn giá theo khu vực và thuế GTGT áp dụng khi tính tiền trên{" "}
          <Link href="/admin/billing-sheet?route=all" className="text-[var(--primary)] hover:underline">
            Bảng thu nước
          </Link>
          {" "}
          / hóa đơn.
        </p>
      </div>

      <form action={saveVatSettings} className="card mb-6">
        <h2 className="mb-2 font-semibold">Thuế GTGT (VAT)</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Đơn giá đã gồm VAT. Thành tiền = m³ × đơn giá; trên hóa đơn tách Giá (trước thuế) + Thuế
          GTGT. Hóa đơn đã thu giữ nguyên thành tiền đã ghi.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label mb-0 text-xs" htmlFor="vatPercent">
              Thuế VAT (%)
            </label>
            <input
              id="vatPercent"
              name="vatPercent"
              type="number"
              min={0}
              max={100}
              step={0.1}
              className="input w-28 py-1.5 text-right font-mono tabular-nums"
              defaultValue={vatPercent}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Lưu thuế VAT
          </button>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Nhập <strong>{formatCurrency(defaultPrice)}</strong>/m³ (gồm VAT) — trên hóa đơn in đơn giá{" "}
          <strong>{formatCurrency(unitOnReceipt)}</strong>/m³ (trước thuế). Ví dụ 10 m³: Thành tiền{" "}
          <strong>{formatCurrency(vatSample.totalAmount)}</strong>
          {vatSample.vatAmount > 0 && (
            <>
              {" "}
              (dòng SL×đơn giá {formatCurrency(vatSample.subtotal)}
              {" "}
              + GTGT {vatSample.vatPercent}% {formatCurrency(vatSample.vatAmount)})
            </>
          )}
        </p>
      </form>

      <form action={saveRoutePrices} className="card mb-6 overflow-x-auto p-0">
        <table className="table-modern">
          <thead className="border-b bg-slate-50 text-left text-sm">
            <tr>
              <th>Khu vực</th>
              <th className="w-28 text-right">Số hộ</th>
              <th className="w-44">Giá (đ/m³, gồm VAT)</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => (
              <tr key={r.id} className="border-b">
                <td>
                  <span className="font-semibold">{r.name}</span>
                  <span className="ml-2 text-xs text-[var(--muted)]">mã {r.code}</span>
                </td>
                <td className="text-right tabular-nums">{r._count.households}</td>
                <td>
                  <input
                    name={`price_${r.id}`}
                    type="number"
                    min={0}
                    step={500}
                    className="input w-full py-1.5 text-right font-mono tabular-nums"
                    defaultValue={Math.round(r.unitPrice ?? defaultPrice)}
                    aria-label={`Giá ${r.name}`}
                  />
                </td>
              </tr>
            ))}
            {!routes.length && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-sm text-[var(--muted)]">
                  Chưa có khu vực — thêm bên dưới.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {routes.length > 0 && (
          <div className="border-t border-[var(--border)] p-3">
            <button type="submit" className="btn btn-primary">
              Lưu tất cả giá
            </button>
          </div>
        )}
      </form>

      <div className="card">
        <h2 className="mb-3 font-semibold">Thêm khu vực mới</h2>
        <form action={createRouteWithPrice} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label mb-0 text-xs">Mã</label>
            <input name="code" className="input w-24 py-1.5" placeholder="212" required />
          </div>
          <div className="min-w-[10rem] flex-1">
            <label className="label mb-0 text-xs">Tên khu vực</label>
            <input name="name" className="input w-full py-1.5" placeholder="ĐƯỜNG 212" required />
          </div>
          <div>
            <label className="label mb-0 text-xs">Giá đ/m³</label>
            <input
              name="unitPrice"
              type="number"
              min={0}
              step={500}
              className="input w-28 py-1.5 text-right font-mono"
              defaultValue={defaultPrice}
              required
            />
          </div>
          <div>
            <label className="label mb-0 text-xs">Thứ tự</label>
            <input
              name="sortOrder"
              type="number"
              className="input w-16 py-1.5"
              defaultValue={routes.length + 1}
            />
          </div>
          <button type="submit" className="btn btn-secondary">
            Thêm
          </button>
        </form>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Gán hộ vào khu vực:{" "}
          <Link href="/admin/routes" className="text-[var(--primary)] hover:underline">
            Sắp xếp hộ theo tuyến
          </Link>
          {" · "}
          Tải/upload Excel:{" "}
          <Link href="/admin/billing-sheet?route=all" className="text-[var(--primary)] hover:underline">
            Bảng thu nước
          </Link>
        </p>
      </div>

      <p className="mt-4 text-sm text-[var(--muted)]">
        Ví dụ giá hiện tại mặc định sinh hoạt: <strong>{formatCurrency(defaultPrice)}/m³</strong>
      </p>
    </>
  );
}
