"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { InvoiceStatus, ReadingStatus } from "@/lib/types/enums";;
import type { BillingSheetRow } from "@/lib/billingSheet";
import { formatCurrency, previewBillingRow } from "@/lib/billing";
import { readingStatusLabel } from "@/lib/vi";
import { BillingSheetInvoiceBtn } from "@/components/BillingSheetInvoiceBtn";

export type ReadingStatusFilter = "all" | "pending" | "confirmed" | "rejected";

type Props = {
  periodId: string;
  rows: BillingSheetRow[];
  statusFilter?: ReadingStatusFilter;
  /** Bảng tổng — hiện cột khu vực */
  showRoute?: boolean;
};

export function BillingSheetGrid({
  periodId,
  rows,
  statusFilter = "all",
  showRoute = false,
}: Props) {
  const [localRows, setLocalRows] = useState(rows);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return localRows;
    if (statusFilter === "pending") {
      return localRows.filter((r) => r.status === ReadingStatus.PENDING);
    }
    if (statusFilter === "confirmed") {
      return localRows.filter((r) => r.status === ReadingStatus.CONFIRMED);
    }
    return localRows.filter((r) => r.status === ReadingStatus.REJECTED);
  }, [localRows, statusFilter]);

  const initDraft = useCallback((row: BillingSheetRow) => {
    if (row.csm != null) return String(row.csm);
    return "";
  }, []);

  function getDraft(householdId: string, row: BillingSheetRow): string {
    if (drafts[householdId] !== undefined) return drafts[householdId] ?? "";
    return initDraft(row);
  }

  function setDraft(householdId: string, value: string) {
    setDrafts((d) => ({ ...d, [householdId]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[householdId];
      return next;
    });
  }

  function applyReadingUpdate(
    householdId: string,
    reading: {
      id: string;
      confirmedValue: number | null;
      status: ReadingStatus;
      usageM3: number | null;
    },
    unitPrice: number,
    oldReading: number,
    invoice?: {
      id: string;
      totalAmount: number;
      usageM3: number;
    } | null
  ) {
    const csm = reading.confirmedValue ?? 0;
    const preview = previewBillingRow(oldReading, csm, unitPrice);
    setLocalRows((prev) =>
      prev.map((r) =>
        r.householdId === householdId
          ? {
              ...r,
              readingId: reading.id,
              csm,
              status: reading.status,
              usageM3: invoice?.usageM3 ?? reading.usageM3 ?? preview.usageM3,
              totalAmount: invoice?.totalAmount ?? preview.totalAmount,
              invoiceId: invoice?.id ?? r.invoiceId,
            }
          : r
      )
    );
  }

  async function saveRow(row: BillingSheetRow) {
    const raw = getDraft(row.householdId, row);
    const confirmedValue = parseFloat(raw);
    if (Number.isNaN(confirmedValue) || confirmedValue <= 0) {
      setErrors((e) => ({ ...e, [row.householdId]: "Nhập CSM hợp lệ" }));
      return;
    }
    if (confirmedValue < row.oldReading) {
      setErrors((e) => ({
        ...e,
        [row.householdId]: `CSM phải ≥ CSC (${row.oldReading})`,
      }));
      return;
    }

    setSaving(row.householdId);
    try {
      const res = await fetch("/api/admin/readings/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: row.householdId,
          periodId,
          confirmedValue,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setErrors((e) => ({ ...e, [row.householdId]: body.error ?? "Lỗi lưu" }));
        return;
      }
      applyReadingUpdate(
        row.householdId,
        body.reading,
        row.unitPrice,
        row.oldReading,
        body.invoice ?? null
      );
      setDrafts((d) => {
        const next = { ...d };
        delete next[row.householdId];
        return next;
      });
    } catch {
      setErrors((e) => ({ ...e, [row.householdId]: "Lỗi kết nối" }));
    } finally {
      setSaving(null);
    }
  }

  async function approveRow(row: BillingSheetRow) {
    if (!row.readingId) {
      setErrors((e) => ({ ...e, [row.householdId]: "Chưa có bản ghi chỉ số" }));
      return;
    }
    const raw = getDraft(row.householdId, row);
    const confirmedValue = parseFloat(raw);
    const body: { readingId: string; confirmedValue?: number } = {
      readingId: row.readingId,
    };
    if (!Number.isNaN(confirmedValue) && confirmedValue > 0) {
      body.confirmedValue = confirmedValue;
    }

    setSaving(row.householdId);
    try {
      const res = await fetch("/api/admin/readings/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors((e) => ({ ...e, [row.householdId]: data.error ?? "Không chốt được" }));
        return;
      }
      applyReadingUpdate(
        row.householdId,
        data.reading,
        row.unitPrice,
        row.oldReading,
        data.invoice ?? null
      );
      setDrafts((d) => {
        const next = { ...d };
        delete next[row.householdId];
        return next;
      });
    } catch {
      setErrors((e) => ({ ...e, [row.householdId]: "Lỗi kết nối" }));
    } finally {
      setSaving(null);
    }
  }

  async function markPaid(row: BillingSheetRow) {
    if (!row.invoiceId) {
      setErrors((e) => ({
        ...e,
        [row.householdId]: "Chưa có hóa đơn — tạo HĐ trước",
      }));
      return;
    }
    if (row.paid) return;

    const amount =
      row.totalAmount != null && row.totalAmount > 0
        ? formatCurrency(row.totalAmount)
        : "số tiền trên hóa đơn";
    if (
      !confirm(
        `Xác nhận hộ ${row.householdCode} (${row.residentName}) đã thanh toán ${amount}?`
      )
    ) {
      return;
    }

    setSaving(row.householdId);
    try {
      const res = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: row.invoiceId, method: "TRANSFER" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors((e) => ({ ...e, [row.householdId]: data.error ?? "Không ghi được" }));
        return;
      }
      setLocalRows((prev) =>
        prev.map((r) =>
          r.householdId === row.householdId
            ? { ...r, paid: true, invoiceStatus: InvoiceStatus.PAID }
            : r
        )
      );
    } catch {
      setErrors((e) => ({ ...e, [row.householdId]: "Lỗi kết nối" }));
    } finally {
      setSaving(null);
    }
  }

  async function rejectRow(row: BillingSheetRow) {
    if (!row.readingId) return;
    if (!confirm(`Từ chối chỉ số hộ ${row.householdCode}? Hộ sẽ gửi lại được.`)) return;

    setSaving(row.householdId);
    try {
      const res = await fetch("/api/admin/readings/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readingId: row.readingId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors((e) => ({ ...e, [row.householdId]: data.error ?? "Không từ chối được" }));
        return;
      }
      setLocalRows((prev) =>
        prev.map((r) =>
          r.householdId === row.householdId
            ? { ...r, status: ReadingStatus.REJECTED, usageM3: null, totalAmount: null }
            : r
        )
      );
    } catch {
      setErrors((e) => ({ ...e, [row.householdId]: "Lỗi kết nối" }));
    } finally {
      setSaving(null);
    }
  }

  function focusNext(currentId: string) {
    const idx = filteredRows.findIndex((r) => r.householdId === currentId);
    const next = filteredRows[idx + 1];
    if (next) inputRefs.current[next.householdId]?.focus();
  }

  if (!filteredRows.length) {
    return (
      <div className="card text-sm text-[var(--muted)]">
        Không có hộ nào trong bộ lọc này.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto card p-0">
      <table className="table-modern billing-sheet-table min-w-[960px]">
        <thead className="sticky top-0 z-10 border-b bg-slate-100 text-left text-xs">
          <tr>
            <th className="w-10" title="Thứ tự trên tuyến">
              #
            </th>
            {showRoute && <th className="w-28">Khu vực</th>}
            <th>Họ tên</th>
            <th className="w-24">Mã hộ</th>
            <th className="w-16 text-right" title="Chỉ số cũ">
              Số cũ
            </th>
            <th className="w-28 text-right" title="Chỉ số mới — nhập tại đây">
              Số mới
            </th>
            <th className="w-14 text-right" title="Tiêu thụ m³">
              m³
            </th>
            <th className="w-24 text-right">Tiền</th>
            <th className="w-16 text-center">Hóa đơn</th>
            <th className="w-32 text-center">Chỉ số tháng này</th>
            <th
              className="w-28 text-center"
              title="Bấm nút vàng「Xác nhận đã thu tiền」khi hộ đã nộp"
            >
              Xác nhận thu
            </th>
            <th className="w-20 text-center">Ảnh</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row, index) => {
            const draft = getDraft(row.householdId, row);
            const draftNum = draft === "" ? null : parseFloat(draft);
            const preview =
              draftNum != null && !Number.isNaN(draftNum)
                ? previewBillingRow(row.oldReading, draftNum, row.unitPrice)
                : row.csm != null
                  ? previewBillingRow(row.oldReading, row.csm, row.unitPrice)
                  : previewBillingRow(row.oldReading, null, row.unitPrice);

            const missing = row.csm == null && draft === "";
            const pending = row.status === ReadingStatus.PENDING;
            const rowClass = [
              "border-b",
              missing ? "bg-amber-50/80" : "",
              pending ? "bg-sky-50/50" : "",
              row.status === ReadingStatus.REJECTED ? "bg-red-50/40" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <tr key={row.householdId} className={rowClass}>
                <td className="text-center text-[var(--muted)]">
                  {row.routeSortOrder ?? index + 1}
                </td>
                {showRoute && (
                  <td className="text-xs text-[var(--muted)]">{row.routeName ?? "—"}</td>
                )}
                <td className="font-medium">{row.residentName}</td>
                <td className="font-mono text-sm font-semibold">{row.householdCode}</td>
                <td className="text-right font-mono tabular-nums">{row.oldReading}</td>
                <td className="text-right">
                  <input
                    ref={(el) => {
                      inputRefs.current[row.householdId] = el;
                    }}
                    type="number"
                    inputMode="decimal"
                    className="input w-full max-w-[7rem] py-1 text-right font-mono tabular-nums disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="—"
                    value={draft}
                    disabled={row.paid}
                    title={row.paid ? "Đã xác nhận thu — không thể sửa chỉ số" : undefined}
                    onChange={(e) => setDraft(row.householdId, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (pending) void approveRow(row).then(() => focusNext(row.householdId));
                        else void saveRow(row).then(() => focusNext(row.householdId));
                      }
                    }}
                  />
                  {pending && (
                    <span className="badge badge-warning mt-0.5 block text-[10px]">
                      Chờ chốt
                    </span>
                  )}
                </td>
                <td className="text-right font-mono tabular-nums">
                  {preview.usageM3 != null ? preview.usageM3 : "—"}
                </td>
                <td className="text-right font-mono tabular-nums text-sm">
                  {preview.totalLabel}
                </td>
                <td className="text-center">
                  <BillingSheetInvoiceBtn
                    periodId={periodId}
                    householdId={row.householdId}
                    invoiceId={row.invoiceId}
                    pdfPath={row.pdfPath}
                    status={row.status}
                  />
                </td>
                <td className="space-y-1 text-center text-xs">
                  <div className="mx-auto flex max-w-[7rem] flex-col gap-1">
                    {row.paid ? (
                      <span
                        className="text-[10px] text-[var(--muted)]"
                        title="Đã xác nhận thu — không thể sửa chỉ số"
                      >
                        Đã khóa
                      </span>
                    ) : pending ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary py-1 text-xs"
                          disabled={saving === row.householdId}
                          onClick={() => void approveRow(row)}
                        >
                          {saving === row.householdId ? "…" : "Chốt"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary py-1 text-xs"
                          disabled={saving === row.householdId}
                          onClick={() => void rejectRow(row)}
                        >
                          Từ chối
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary py-1 text-xs"
                        disabled={saving === row.householdId}
                        onClick={() => void saveRow(row)}
                      >
                        {saving === row.householdId ? "…" : "Lưu"}
                      </button>
                    )}
                  </div>
                  {errors[row.householdId] && (
                    <p className="text-[10px] text-[var(--danger)]">{errors[row.householdId]}</p>
                  )}
                  {row.status && !errors[row.householdId] && (
                    <p className="text-[10px] text-[var(--muted)]">
                      {readingStatusLabel(row.status)}
                    </p>
                  )}
                </td>
                <td className="text-center text-xs">
                  {row.paid ? (
                    <span className="badge badge-success">Đã thu</span>
                  ) : row.invoiceId ? (
                    <button
                      type="button"
                      className="btn btn-mark-paid whitespace-nowrap px-2.5 py-1.5 text-[11px] font-bold"
                      disabled={saving === row.householdId}
                      title="Bấm để ghi nhận hộ này đã nộp tiền"
                      aria-label={`Xác nhận đã thu tiền hộ ${row.householdCode}`}
                      onClick={() => void markPaid(row)}
                    >
                      {saving === row.householdId ? "Đang lưu…" : "Xác nhận thu"}
                    </button>
                  ) : row.status === ReadingStatus.CONFIRMED ? (
                    <span
                      className="text-[10px] text-[var(--muted)]"
                      title="Tạo hóa đơn (cột Hóa đơn) trước khi xác nhận thu"
                    >
                      Chưa có HĐ
                    </span>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
                <td className="text-center text-xs">
                  {row.hasImage && row.imagePath ? (
                    <a
                      href={row.imagePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[var(--primary)] hover:underline"
                    >
                      Xem ảnh
                    </a>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
