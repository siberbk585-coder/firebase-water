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

  function isAndroidChrome() {
    const ua = navigator.userAgent;
    return /Android/i.test(ua) && /Chrome/i.test(ua) && !/EdgA|OPR|Firefox/i.test(ua);
  }

  function printPdfBlob(blob: Blob, printWindow?: Window | null) {
    const blobUrl = URL.createObjectURL(blob);
    if (printWindow && !printWindow.closed) {
      printWindow.location.href = blobUrl;
      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch {
          printWindow.document.body.innerHTML = `
            <main style="font-family: system-ui, sans-serif; padding: 20px;">
              <p>Không mở được hộp thoại in tự động.</p>
              <p>Dùng menu Chrome để in hóa đơn hoặc mở lại PDF.</p>
              <p><a href="${blobUrl}">Mở PDF hóa đơn</a></p>
            </main>
          `;
        }
      }, 900);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.src = blobUrl;

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      iframe.remove();
      URL.revokeObjectURL(blobUrl);
    };

    iframe.onload = () => {
      setTimeout(() => {
        try {
          const frameWindow = iframe.contentWindow;
          if (!frameWindow) throw new Error("Không mở được khung in");
          frameWindow.focus();
          frameWindow.print();
          frameWindow.onafterprint = cleanup;
          setTimeout(cleanup, 120_000);
        } catch {
          window.open(blobUrl, "_blank", "noopener,noreferrer");
          setTimeout(cleanup, 120_000);
        }
      }, 250);
    };

    document.body.appendChild(iframe);
  }

  if (status !== ReadingStatus.CONFIRMED) {
    return (
      <span className="billing-receipt-muted text-[10px] text-[var(--muted)]">
        Chốt số trước
      </span>
    );
  }

  async function printInvoice() {
    setLoading(true);
    const androidPrintWindow = isAndroidChrome()
      ? window.open("", "_blank")
      : null;
    if (androidPrintWindow) {
      androidPrintWindow.document.write(`
        <main style="font-family: system-ui, sans-serif; padding: 20px;">
          <h1 style="font-size: 18px;">Đang chuẩn bị hóa đơn...</h1>
          <p>Vui lòng chờ trong giây lát.</p>
        </main>
      `);
      androidPrintWindow.document.close();
    }

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
      printPdfBlob(blob, androidPrintWindow);
      router.refresh();
    } catch {
      if (androidPrintWindow && !androidPrintWindow.closed) {
        androidPrintWindow.close();
      }
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
          ? "In hóa đơn đã tạo"
          : "Tạo hóa đơn (tính tiền) và in"
      }
    >
      {loading ? "…" : "In hóa đơn"}
    </button>
  );
}
