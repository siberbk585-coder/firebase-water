"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ReadingStatus } from "@/lib/types/enums";
import { useBillingPrintSelectionOptional } from "@/components/billing-print-selection";
import { isRestrictedWebView, openPdfBlob } from "@/lib/pdfBlobUi";
import {
  BILLING_SHEET_SEARCH_EVENT,
  billingSheetSearchScore,
  matchesBillingSheetSearch,
} from "@/lib/billingSheetSearch";

export type BillingPrintRow = {
  householdId: string;
  householdCode: string;
  meterCode?: string | null;
  residentName: string;
  address?: string | null;
  contactPhone?: string | null;
  routeName?: string | null;
  status: ReadingStatus | null;
};

type Props = {
  periodId: string;
  rows: BillingPrintRow[];
  initialSearchQuery?: string;
};

export function BillingPrintPanel({ periodId, rows, initialSearchQuery = "" }: Props) {
  const selection = useBillingPrintSelectionOptional();
  const router = useRouter();
  const [loading, setLoading] = useState<"batch" | "one" | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    function onSearch(event: Event) {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      setSearchQuery(detail?.query ?? "");
    }

    window.addEventListener(BILLING_SHEET_SEARCH_EVENT, onSearch);
    return () => window.removeEventListener(BILLING_SHEET_SEARCH_EVENT, onSearch);
  }, []);

  const visibleRows = useMemo(() => {
    if (!deferredSearchQuery.trim()) return rows;
    const matched = rows.filter((r) => matchesBillingSheetSearch(r, deferredSearchQuery));
    return [...matched].sort((a, b) => {
      const sa = billingSheetSearchScore(a, deferredSearchQuery);
      const sb = billingSheetSearchScore(b, deferredSearchQuery);
      return sb - sa;
    });
  }, [rows, deferredSearchQuery]);

  const confirmedOnTable = useMemo(
    () => visibleRows.filter((r) => r.status === ReadingStatus.CONFIRMED),
    [visibleRows]
  );

  const selectedConfirmed = useMemo(() => {
    if (!selection?.selectedIds.size) return [];
    return confirmedOnTable.filter((r) => selection.selectedIds.has(r.householdId));
  }, [confirmedOnTable, selection]);

  const batchTargets =
    selectedConfirmed.length > 0 ? selectedConfirmed : confirmedOnTable;

  async function openPdfResponse(res: Response, fileName = "hoa-don-gop.pdf") {
    const blob = await res.blob();
    openPdfBlob(blob, { fileName, title: "Hóa đơn gộp", tryPrint: !isRestrictedWebView() });
    router.refresh();
  }

  async function printBatch() {
    if (!batchTargets.length) {
      alert("Không có hộ đã chốt CSM trên bảng để in.");
      return;
    }
    if (
      !confirm(
        `Tạo và mở 1 file PDF gộp ${batchTargets.length} hóa đơn?\n(Các hộ chưa chốt sẽ bỏ qua.)`
      )
    ) {
      return;
    }

    setLoading("batch");
    try {
      const res = await fetch("/api/invoices/export-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodId,
          householdIds: batchTargets.map((r) => r.householdId),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? "Không in hàng loạt được");
        return;
      }
      const ok = res.headers.get("X-Invoice-Count");
      const err = res.headers.get("X-Invoice-Errors");
      await openPdfResponse(res);
      if (err && Number(err) > 0) {
        alert(`Đã gộp ${ok ?? batchTargets.length} hóa đơn. ${err} hộ lỗi (chưa chốt hoặc thiếu dữ liệu).`);
      }
    } catch {
      alert("Không in hàng loạt được");
    } finally {
      setLoading(null);
    }
  }

  async function printOneByOne() {
    const targets = batchTargets;
    if (!targets.length) {
      alert("Không có hộ đã chốt trên bảng.");
      return;
    }
    if (isRestrictedWebView()) {
      alert(
        "Trên app điện thoại, hãy dùng「In hàng loạt」(1 file PDF gộp) hoặc in từng hộ ở cột Hóa đơn."
      );
      return;
    }

    if (
      !confirm(
        `Mở lần lượt ${targets.length} cửa sổ PDF (từng hộ)?\nTrên máy tính: cho phép popup nếu trình duyệt hỏi.`
      )
    ) {
      return;
    }

    setLoading("one");
    let ok = 0;
    let fail = 0;
    try {
      for (const row of targets) {
        try {
          const res = await fetch("/api/invoices/export-one", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ householdId: row.householdId, periodId }),
          });
          if (!res.ok) {
            fail++;
            continue;
          }
          const blob = await res.blob();
          openPdfBlob(blob, {
            fileName: `hoa-don-${row.householdCode}.pdf`,
            title: `Hóa đơn ${row.householdCode}`,
          });
          ok++;
          await new Promise((r) => setTimeout(r, 600));
        } catch {
          fail++;
        }
      }
      router.refresh();
      if (fail > 0) {
        alert(`Đã mở ${ok} PDF. ${fail} hộ lỗi.`);
      }
    } finally {
      setLoading(null);
    }
  }

  const batchLabel =
    selectedConfirmed.length > 0
      ? `In đã chọn (${selectedConfirmed.length})`
      : `In hàng loạt (${confirmedOnTable.length})`;

  return (
    <aside
      className="flex w-full shrink-0 flex-col gap-1.5 self-start rounded-lg border border-[var(--border)] bg-slate-50/90 p-2 sm:w-52 lg:-mt-1"
      aria-label="In hóa đơn"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        In hóa đơn
      </span>
      <button
        type="button"
        className="billing-receipt-action w-full justify-center disabled:opacity-50"
        disabled={loading !== null || !batchTargets.length}
        onClick={() => void printBatch()}
        title="Gộp tất cả hóa đơn đã chốt trên bảng thành một file PDF"
      >
        {loading === "batch" ? "Đang tạo…" : batchLabel}
      </button>
      <button
        type="button"
        className="btn btn-secondary w-full py-1.5 text-xs"
        disabled={loading !== null || !batchTargets.length}
        onClick={() => void printOneByOne()}
        title="Mở từng PDF một tab (theo từng hộ)"
      >
        {loading === "one" ? "Đang mở…" : "Từng hộ (nhiều tab)"}
      </button>
      <p className="text-[10px] leading-snug text-[var(--muted)]">
        Cột <strong>Hóa đơn</strong>: in một hộ. Tick chọn hàng để in nhóm.
      </p>
    </aside>
  );
}
