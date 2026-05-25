"use client";

import { useState } from "react";

export function SendInvoiceButton({
  invoiceId,
  onSent,
}: {
  invoiceId: string;
  onSent?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setLoading(true);
    const res = await fetch("/api/invoices/send-bank-transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId }),
    });
    setLoading(false);
    if (res.ok) onSent?.();
    else {
      const d = await res.json().catch(() => ({}));
      alert("Lỗi gửi: " + ((d as { error?: string }).error ?? "unknown"));
    }
  }

  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={loading}
      className="btn whitespace-nowrap border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
    >
      {loading ? "Đang gửi…" : "Gửi HĐ"}
    </button>
  );
}

export function SendAllBankTransferButton({ periodId }: { periodId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    sent: number;
    skipped: number;
    total: number;
  } | null>(null);

  async function handleSendAll() {
    if (!confirm("Gửi hóa đơn cho tất cả hộ chuyển khoản chưa thanh toán trong kỳ này?")) return;
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/invoices/send-bank-transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodId }),
    });
    setLoading(false);
    if (res.ok) {
      const d = (await res.json()) as { sent: number; skipped: number; total: number };
      setResult(d);
      setTimeout(() => setResult(null), 4000);
    } else {
      alert("Lỗi gửi hàng loạt");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSendAll}
        disabled={loading}
        className="btn border border-blue-300 bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Đang gửi…" : "Gửi tất cả CK"}
      </button>
      {result && (
        <span className="text-xs text-slate-600">
          ✓ Đã gửi {result.sent}/{result.total}
          {result.skipped > 0 ? ` (${result.skipped} bỏ qua — webhook chưa cấu hình)` : ""}
        </span>
      )}
    </div>
  );
}
