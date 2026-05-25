"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConfirmPaymentButton({
  invoiceId,
  method,
}: {
  invoiceId: string;
  method: "CASH" | "BANK_TRANSFER";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function confirm() {
    setLoading(true);
    const res = await fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId, method }),
    });
    setLoading(false);
    if (res.ok) router.refresh();
    else alert("Lỗi xác nhận");
  }

  return (
    <button type="button" className="btn btn-primary text-xs" onClick={confirm} disabled={loading}>
      {loading ? "..." : "Xác nhận TT"}
    </button>
  );
}
