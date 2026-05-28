"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReadingStatus } from "@/lib/types/enums";;
import { openPdfBlob } from "@/lib/pdfBlobUi";

export function BillingSheetInvoiceBtn({
  periodId,
  householdId,
  invoiceId,
  pdfPath,
  status,
  onInvoiceCreated,
}: {
  periodId: string;
  householdId: string;
  invoiceId: string | null;
  pdfPath: string | null;
  status: ReadingStatus | null;
  /** Cập nhật ngay bảng sau khi tạo hóa đơn (không cần đổi tab). */
  onInvoiceCreated?: (invoiceId: string) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (status !== ReadingStatus.CONFIRMED) {
    return (
      <span className="billing-receipt-muted text-[10px] text-[var(--muted)]">
        Chốt số trước
      </span>
    );
  }

  async function printInvoice() {
    setLoading(true);
    try {
      const url = invoiceId
        ? `/api/invoices/${invoiceId}/export-local`
        : null;
      const res = invoiceId
        ? await fetch(url!)
        : await fetch("/api/invoices/export-one", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ householdId, periodId }),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? "Không tạo được hóa đơn");
        return;
      }
      const blob = await res.blob();
      const createdId =
        res.headers.get("X-Invoice-Id") ?? (invoiceId ? invoiceId : null);
      if (createdId) onInvoiceCreated?.(createdId);

      const disposition = res.headers.get("Content-Disposition") ?? "";
      const nameMatch = disposition.match(/filename="?([^";]+)"?/i);
      openPdfBlob(blob, {
        fileName: nameMatch?.[1] ?? "hoa-don.pdf",
        title: pdfPath ? "Hóa đơn" : "Hóa đơn vừa tạo",
        tryPrint: true,
      });
      router.refresh();
    } catch {
      alert("Không in được hóa đơn");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="billing-receipt-action disabled:opacity-50"
      disabled={loading}
      onClick={() => void printInvoice()}
      title={
        pdfPath
          ? "Xem / in hóa đơn đã tạo"
          : "Tạo hóa đơn (tính tiền) và xem PDF"
      }
    >
      {loading ? "…" : "In hóa đơn"}
    </button>
  );
}
