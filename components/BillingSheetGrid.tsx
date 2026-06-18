"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { InvoiceStatus, ReadingStatus } from "@/lib/types/enums";;
import type { BillingSheetRow } from "@/lib/billingSheet";
import {
  formatBillingAmountCell,
  formatCurrency,
  previewBillingRow,
  resolveBillingDisplay,
  type BillingPreview,
} from "@/lib/billing";
import { readingStatusLabel } from "@/lib/vi";
import { BillingSheetInvoiceBtn } from "@/components/BillingSheetInvoiceBtn";
import { useBillingPrintSelectionOptional } from "@/components/billing-print-selection";
import {
  type BillingSheetStatusFilter,
  matchesBillingSheetStatusFilter,
} from "@/lib/billingSheetFilters";
import {
  BILLING_SHEET_SEARCH_EVENT,
  billingSheetSearchScore,
  matchesBillingSheetSearch,
} from "@/lib/billingSheetSearch";

export type ReadingStatusFilter = BillingSheetStatusFilter;

function rowPreview(
  row: BillingSheetRow,
  csm: number | null,
  vatPercent: number
): BillingPreview {
  return previewBillingRow(row.oldReading, csm, row.unitPrice, vatPercent);
}

function BillingMoneyCells({
  amounts,
  showVat,
}: {
  amounts: BillingPreview;
  showVat: boolean;
}) {
  if (!showVat) {
    return (
      <td className="billing-sheet-col-num billing-sheet-col-total text-right font-mono text-sm tabular-nums">
        {formatBillingAmountCell(amounts.totalAmount)}
      </td>
    );
  }
  return (
    <>
      <td className="billing-sheet-col-num billing-sheet-col-gia text-right font-mono text-sm tabular-nums text-[var(--muted)]">
        {formatBillingAmountCell(amounts.subtotal)}
      </td>
      <td className="billing-sheet-col-num billing-sheet-col-vat text-right font-mono text-sm tabular-nums text-[var(--muted)]">
        {formatBillingAmountCell(amounts.vatAmount)}
      </td>
      <td className="billing-sheet-col-num billing-sheet-col-total text-right font-mono text-sm font-semibold tabular-nums">
        {formatBillingAmountCell(amounts.totalAmount)}
      </td>
    </>
  );
}

type Props = {
  periodId: string;
  rows: BillingSheetRow[];
  statusFilter?: BillingSheetStatusFilter;
  initialSearchQuery?: string;
  vatPercent?: number;
  /** Bảng tổng — hiện cột khu vực */
  showRoute?: boolean;
  /** ADMIN — cho phép sửa chỉ số hộ đã thu */
  allowPaidEdit?: boolean;
};

export function BillingSheetGrid({
  periodId,
  rows,
  statusFilter = "all",
  initialSearchQuery = "",
  vatPercent = 0,
  showRoute = false,
  allowPaidEdit = false,
}: Props) {
  const [localRows, setLocalRows] = useState(rows);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const printSelection = useBillingPrintSelectionOptional();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalRows(rows);
  }, [rows]);

  useEffect(() => {
    function onSearch(event: Event) {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      setSearchQuery(detail?.query ?? "");
    }

    window.addEventListener(BILLING_SHEET_SEARCH_EVENT, onSearch);
    return () => window.removeEventListener(BILLING_SHEET_SEARCH_EVENT, onSearch);
  }, []);

  useEffect(() => {
    if (!savedHint) return;
    const t = window.setTimeout(() => setSavedHint(null), 4000);
    return () => window.clearTimeout(t);
  }, [savedHint]);

  const searchMatchedRows = useMemo(() => {
    if (!deferredSearchQuery.trim()) return localRows;
    const matched = localRows.filter((r) =>
      matchesBillingSheetSearch(r, deferredSearchQuery)
    );
    return [...matched].sort((a, b) => {
      const sa = billingSheetSearchScore(a, deferredSearchQuery);
      const sb = billingSheetSearchScore(b, deferredSearchQuery);
      if (sb !== sa) return sb - sa;
      return (a.routeSortOrder ?? 0) - (b.routeSortOrder ?? 0);
    });
  }, [localRows, deferredSearchQuery]);

  const isSearchPending =
    searchQuery.trim() !== deferredSearchQuery.trim();

  const filteredRows = useMemo(
    () => searchMatchedRows.filter((r) => matchesBillingSheetStatusFilter(r, statusFilter)),
    [searchMatchedRows, statusFilter]
  );

  const confirmedVisibleIds = useMemo(
    () =>
      filteredRows
        .filter((r) => r.status === ReadingStatus.CONFIRMED)
        .map((r) => r.householdId),
    [filteredRows]
  );

  const allConfirmedSelected =
    confirmedVisibleIds.length > 0 &&
    confirmedVisibleIds.every((id) => printSelection?.selectedIds.has(id));

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
      subtotalAmount?: number;
      vatAmount?: number;
      usageM3: number;
      status?: InvoiceStatus;
    } | null
  ) {
    const csm = reading.confirmedValue ?? 0;
    const preview = previewBillingRow(oldReading, csm, unitPrice, vatPercent);
    setLocalRows((prev) =>
      prev.map((r) =>
        r.householdId === householdId
          ? {
              ...r,
              readingId: reading.id,
              csm,
              status: reading.status,
              usageM3: invoice?.usageM3 ?? reading.usageM3 ?? preview.usageM3,
              subtotalAmount: invoice?.subtotalAmount ?? preview.subtotal,
              vatAmount: invoice?.vatAmount ?? preview.vatAmount,
              totalAmount: invoice?.totalAmount ?? preview.totalAmount,
              invoiceId: invoice?.id ?? r.invoiceId,
              invoiceStatus: invoice?.status ?? r.invoiceStatus,
            }
          : r
      )
    );
  }

  function patchRow(householdId: string, patch: Partial<BillingSheetRow>) {
    setLocalRows((prev) =>
      prev.map((r) => (r.householdId === householdId ? { ...r, ...patch } : r))
    );
  }

  async function saveRow(row: BillingSheetRow) {
    const raw = getDraft(row.householdId, row);
    const confirmedValue = parseFloat(raw);
    if (Number.isNaN(confirmedValue) || confirmedValue <= 0) {
      setErrors((e) => ({ ...e, [row.householdId]: "Nhập CSM hợp lệ" }));
      return;
    }
    if (confirmedValue <= row.oldReading) {
      setErrors((e) => ({
        ...e,
        [row.householdId]: `CSM phải cao hơn CSC (${row.oldReading})`,
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
      setSavedHint(`Đã lưu chỉ số hộ ${row.householdCode}`);
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
      setSavedHint(`Đã chốt chỉ số hộ ${row.householdCode}`);
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
        body: JSON.stringify({ invoiceId: row.invoiceId, method: "BANK_TRANSFER" }),
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
      setSavedHint(`Đã ghi nhận thu tiền hộ ${row.householdCode}`);
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
            ? {
                ...r,
                status: ReadingStatus.REJECTED,
                usageM3: null,
                totalAmount: null,
                invoiceId: null,
                invoiceStatus: null,
                pdfPath: null,
              }
            : r
        )
      );
      setSavedHint(`Đã từ chối chỉ số hộ ${row.householdCode}`);
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

  function getRowState(row: BillingSheetRow) {
    const draft = getDraft(row.householdId, row);
    const draftNum = draft === "" ? null : parseFloat(draft);
    const usePreview = draftNum != null && !Number.isNaN(draftNum);
    const preview = usePreview
      ? rowPreview(row, draftNum, vatPercent)
      : row.csm != null
        ? rowPreview(row, row.csm, vatPercent)
        : rowPreview(row, null, vatPercent);
    const amounts = resolveBillingDisplay(row, preview, usePreview);
    const missing = row.csm == null && draft === "";
    const pending = row.status === ReadingStatus.PENDING;
    return { draft, missing, pending, amounts };
  }

  const showVatColumns = vatPercent > 0;

  if (!filteredRows.length) {
    return (
      <div className="card text-sm text-[var(--muted)]">
        Không có hộ nào trong bộ lọc này.
      </div>
    );
  }

  return (
    <>
      {savedHint && (
        <p
          className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900"
          role="status"
        >
          {savedHint}
        </p>
      )}
      {deferredSearchQuery.trim() && (
        <p className="mb-3 text-sm text-[var(--muted)]">
          Tìm thấy <strong>{filteredRows.length}</strong>/{localRows.length} hộ cho “
          {deferredSearchQuery.trim()}”.
          {isSearchPending && (
            <span className="ml-1 text-xs opacity-70">(đang lọc…)</span>
          )}
        </p>
      )}
      <div className="space-y-3 md:hidden">
        {printSelection && confirmedVisibleIds.length > 0 && (
          <label className="mobile-action-card flex items-center justify-between gap-3 text-sm font-semibold">
            <span>Chọn tất cả hộ đã chốt đang hiển thị</span>
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-slate-300"
              checked={allConfirmedSelected}
              aria-label="Chọn tất cả hộ đã chốt trên danh sách"
              onChange={() =>
                printSelection.toggleMany(confirmedVisibleIds, !allConfirmedSelected)
              }
            />
          </label>
        )}

        {filteredRows.map((row, index) => {
          const { draft, missing, pending, amounts } = getRowState(row);
          const cardClass = [
            "mobile-action-card",
            missing ? "border-amber-200 bg-amber-50/80" : "",
            pending ? "border-sky-200 bg-sky-50/70" : "",
            row.status === ReadingStatus.REJECTED ? "border-red-200 bg-red-50/70" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <article key={row.householdId} className={cardClass}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base font-bold text-[var(--foreground)]">
                      {row.householdCode}
                    </span>
                    {row.status && (
                      <span
                        className={[
                          "badge",
                          row.status === ReadingStatus.CONFIRMED
                            ? "badge-success"
                            : row.status === ReadingStatus.PENDING
                              ? "badge-warning"
                              : "badge-danger",
                        ].join(" ")}
                      >
                        {readingStatusLabel(row.status)}
                      </span>
                    )}
                    {row.paid && <span className="badge badge-success">Đã thu</span>}
                  </div>
                  <h2 className="mt-1 truncate text-sm font-semibold">
                    {row.residentName}
                  </h2>
                  <p className="text-xs text-[var(--muted)]">
                    {showRoute && row.routeName ? `${row.routeName} · ` : ""}
                    STT {row.routeSortOrder ?? index + 1} · ĐH {row.meterCode}
                  </p>
                </div>
                {printSelection && row.status === ReadingStatus.CONFIRMED && (
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300"
                    checked={printSelection.selectedIds.has(row.householdId)}
                    aria-label={`Chọn in hóa đơn ${row.householdCode}`}
                    onChange={() => printSelection.toggle(row.householdId)}
                  />
                )}
              </div>

              <div className="mobile-meta-grid">
                <div>
                  <span className="mobile-meta-label">Số cũ</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {row.oldReading}
                  </span>
                </div>
                <div>
                  <span className="mobile-meta-label">Số mới</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="input mt-1 py-2 text-right font-mono tabular-nums disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="—"
                    value={draft}
                    disabled={row.paid && !allowPaidEdit}
                    title={
                      row.paid && !allowPaidEdit
                        ? "Đã xác nhận thu — không thể sửa chỉ số"
                        : row.paid && allowPaidEdit
                          ? "Admin: sửa chỉ số hộ đã thu"
                          : undefined
                    }
                    onChange={(e) => setDraft(row.householdId, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (pending) void approveRow(row);
                        else void saveRow(row);
                      }
                    }}
                  />
                </div>
                <div>
                  <span className="mobile-meta-label">Tiêu thụ</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {amounts.usageM3 != null ? `${amounts.usageM3} m³` : "—"}
                  </span>
                </div>
                {showVatColumns ? (
                  <>
                    <div>
                      <span className="mobile-meta-label">Giá (trước thuế)</span>
                      <span className="font-mono tabular-nums text-[var(--muted)]">
                        {formatBillingAmountCell(amounts.subtotal)}
                      </span>
                    </div>
                    <div>
                      <span className="mobile-meta-label">GTGT {vatPercent}%</span>
                      <span className="font-mono tabular-nums text-[var(--muted)]">
                        {formatBillingAmountCell(amounts.vatAmount)}
                      </span>
                    </div>
                  </>
                ) : null}
                <div className={showVatColumns ? "col-span-2" : ""}>
                  <span className="mobile-meta-label">Thành tiền</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatBillingAmountCell(amounts.totalAmount)}
                  </span>
                </div>
              </div>

              {errors[row.householdId] && (
                <p className="mt-3 rounded-md bg-red-50 px-2 py-1.5 text-xs font-medium text-[var(--danger)]">
                  {errors[row.householdId]}
                </p>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                {row.paid && !allowPaidEdit ? (
                  <span className="btn btn-secondary col-span-2 cursor-default text-xs text-[var(--muted)]">
                    Đã khóa chỉ số
                  </span>
                ) : pending ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary text-xs"
                      disabled={saving === row.householdId}
                      onClick={() => void approveRow(row)}
                    >
                      {saving === row.householdId ? "Đang chốt..." : "Chốt"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary text-xs"
                      disabled={saving === row.householdId}
                      onClick={() => void rejectRow(row)}
                    >
                      Từ chối
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary col-span-2 text-xs"
                    disabled={saving === row.householdId}
                    onClick={() => void saveRow(row)}
                  >
                    {saving === row.householdId
                      ? "Đang lưu..."
                      : row.paid && allowPaidEdit
                        ? "Cập nhật"
                        : "Lưu chỉ số"}
                  </button>
                )}

                <div className="billing-invoice-cell">
                  <BillingSheetInvoiceBtn
                    periodId={periodId}
                    householdId={row.householdId}
                    invoiceId={row.invoiceId}
                    pdfPath={row.pdfPath}
                    status={row.status}
                    onInvoiceCreated={(invoiceId) =>
                      patchRow(row.householdId, {
                        invoiceId,
                        invoiceStatus: InvoiceStatus.ISSUED,
                      })
                    }
                  />
                </div>

                {row.paid ? (
                  <span className="badge badge-success justify-center py-2">Đã thu</span>
                ) : row.invoiceId ? (
                  <button
                    type="button"
                    className="btn btn-mark-paid text-xs"
                    disabled={saving === row.householdId}
                    aria-label={`Xác nhận đã thu tiền hộ ${row.householdCode}`}
                    onClick={() => void markPaid(row)}
                  >
                    {saving === row.householdId ? "Đang lưu..." : "Xác nhận thu"}
                  </button>
                ) : row.status === ReadingStatus.CONFIRMED ? (
                  <span className="flex items-center justify-center rounded-lg border border-[var(--border)] px-2 text-center text-xs text-[var(--muted)]">
                    Chưa có HĐ
                  </span>
                ) : (
                  <span className="flex items-center justify-center rounded-lg border border-[var(--border)] px-2 text-center text-xs text-[var(--muted)]">
                    Chưa chốt
                  </span>
                )}
              </div>

              {row.hasImage && row.imagePath && (
                <a
                  href={row.imagePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-[var(--primary-dark)] hover:underline"
                >
                  Xem ảnh đồng hồ
                </a>
              )}
            </article>
          );
        })}
      </div>

      <div className="billing-sheet-scroll card hidden p-0 md:block">
      <table className="table-modern billing-sheet-table">
        <thead className="border-b text-left text-xs">
          <tr>
            {printSelection && (
              <th className="w-10 text-center" title="Chọn hộ để in hóa đơn">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={allConfirmedSelected}
                  disabled={!confirmedVisibleIds.length}
                  aria-label="Chọn tất cả hộ đã chốt trên bảng"
                  onChange={() =>
                    printSelection.toggleMany(confirmedVisibleIds, !allConfirmedSelected)
                  }
                />
              </th>
            )}
            <th className="w-10" title="Thứ tự trên tuyến">
              #
            </th>
            {showRoute && (
              <th className="billing-sheet-col-route">Khu vực</th>
            )}
            <th className="billing-sheet-col-name">Họ tên · Mã hộ</th>
            <th
              className="billing-sheet-col-num billing-sheet-col-old text-right"
              title="Chỉ số cũ"
            >
              Số cũ
            </th>
            <th
              className="billing-sheet-col-num billing-sheet-col-new text-right"
              title="Chỉ số mới — nhập tại đây"
            >
              Số mới
            </th>
            <th
              className="billing-sheet-col-num billing-sheet-col-m3 text-right"
              title="Tiêu thụ m³"
            >
              m³
            </th>
            {showVatColumns ? (
              <>
                <th
                  className="billing-sheet-col-num billing-sheet-col-gia text-right"
                  title="Tiền nước trước thuế (tách từ thành tiền)"
                >
                  Giá (trước thuế)
                </th>
                <th
                  className="billing-sheet-col-num billing-sheet-col-vat text-right"
                  title={`Thuế GTGT ${vatPercent}% (trong đơn giá đã gồm VAT)`}
                >
                  GTGT
                </th>
                <th
                  className="billing-sheet-col-num billing-sheet-col-total text-right"
                  title="m³ × đơn giá (đã gồm VAT)"
                >
                  Thành tiền
                </th>
              </>
            ) : (
              <th className="billing-sheet-col-num billing-sheet-col-total text-right">
                Thành tiền
              </th>
            )}
            <th className="billing-sheet-col-invoice text-center">Hóa đơn</th>
            <th className="billing-sheet-col-actions text-center">Chỉ số tháng này</th>
            <th
              className="billing-sheet-col-pay text-center"
              title="Bấm nút vàng「Xác nhận đã thu tiền」khi hộ đã nộp"
            >
              Xác nhận thu
            </th>
            <th className="w-16 shrink-0 text-center">Ảnh</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row, index) => {
            const { draft, amounts: rowAmounts } = getRowState(row);
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
                {printSelection && (
                  <td className="text-center">
                    {row.status === ReadingStatus.CONFIRMED ? (
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={printSelection.selectedIds.has(row.householdId)}
                        aria-label={`Chọn in hóa đơn ${row.householdCode}`}
                        onChange={() => printSelection.toggle(row.householdId)}
                      />
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                )}
                <td className="text-center text-[var(--muted)]">
                  {row.routeSortOrder ?? index + 1}
                </td>
                {showRoute && (
                  <td className="billing-sheet-col-route truncate text-xs text-[var(--muted)]">
                    {row.routeName ?? "—"}
                  </td>
                )}
                <td
                  className="billing-sheet-col-name font-medium"
                  title={`${row.residentName} · ${row.householdCode}`}
                >
                  <div className="truncate leading-snug">{row.residentName}</div>
                  <div className="truncate font-mono text-xs font-semibold text-[var(--muted)]">
                    {row.householdCode}
                  </div>
                </td>
                <td className="billing-sheet-col-num billing-sheet-col-old text-right font-mono tabular-nums">
                  {row.oldReading}
                </td>
                <td className="billing-sheet-col-num billing-sheet-col-new text-right">
                  <input
                    ref={(el) => {
                      inputRefs.current[row.householdId] = el;
                    }}
                    type="number"
                    inputMode="decimal"
                    className="billing-sheet-csm-input input py-1 text-right font-mono tabular-nums disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="—"
                    value={draft}
                    disabled={row.paid && !allowPaidEdit}
                    title={
                      row.paid && !allowPaidEdit
                        ? "Đã xác nhận thu — không thể sửa chỉ số"
                        : row.paid && allowPaidEdit
                          ? "Admin: sửa chỉ số hộ đã thu"
                          : undefined
                    }
                    onChange={(e) => setDraft(row.householdId, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (pending) void approveRow(row).then(() => focusNext(row.householdId));
                        else void saveRow(row).then(() => focusNext(row.householdId));
                      }
                    }}
                  />
                </td>
                <td className="billing-sheet-col-num billing-sheet-col-m3 text-right font-mono tabular-nums">
                  {rowAmounts.usageM3 != null ? rowAmounts.usageM3 : "—"}
                </td>
                <BillingMoneyCells amounts={rowAmounts} showVat={showVatColumns} />
                <td className="billing-invoice-cell billing-sheet-col-invoice text-center">
                  <BillingSheetInvoiceBtn
                    periodId={periodId}
                    householdId={row.householdId}
                    invoiceId={row.invoiceId}
                    pdfPath={row.pdfPath}
                    status={row.status}
                    onInvoiceCreated={(invoiceId) =>
                      patchRow(row.householdId, {
                        invoiceId,
                        invoiceStatus: InvoiceStatus.ISSUED,
                      })
                    }
                  />
                </td>
                <td className="billing-sheet-col-actions space-y-1 text-center text-xs">
                  <div className="mx-auto flex min-w-[6.5rem] flex-col gap-1">
                    {row.paid && !allowPaidEdit ? (
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
                        {saving === row.householdId
                          ? "…"
                          : row.paid && allowPaidEdit
                            ? "Cập nhật"
                            : "Lưu"}
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
                <td className="billing-sheet-col-pay text-center text-xs">
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
    </>
  );
}
