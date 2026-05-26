"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReadingStatus } from "@/lib/types/enums";;

export function BillingSheetInvoiceBtn({
  periodId,
  householdId,
  invoiceId,
  pdfPath,
  status,
}: {
  periodId: string;
  householdId: string;
  invoiceId: string | null;
  pdfPath: string | null;
  status: ReadingStatus | null;
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

  async function openPdf() {
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
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      router.refresh();
    } catch {
      alert("Không mở được PDF");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="billing-receipt-action disabled:opacity-50"
      disabled={loading}
      onClick={() => void openPdf()}
      title={
        pdfPath
          ? "Mở file PDF hóa đơn đã tạo"
          : "Tạo hóa đơn (tính tiền) và mở PDF"
      }
    >
      {loading ? "…" : pdfPath ? "Mở PDF" : "Tạo PDF"}
    </button>
  );
}
