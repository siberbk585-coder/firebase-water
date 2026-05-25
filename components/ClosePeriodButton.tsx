"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClosePeriodButton({ periodId }: { periodId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClose() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/periods/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Lỗi đóng kỳ");
        setConfirming(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Lỗi kết nối");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (error) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600">{error}</span>
        <button type="button" onClick={() => setError("")} className="text-xs text-slate-400 underline">
          Đóng
        </button>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Xác nhận đóng kỳ?</span>
        <button
          type="button"
          onClick={() => void handleClose()}
          disabled={loading}
          className="btn border border-amber-300 bg-amber-500 px-3 py-1 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {loading ? "Đang đóng…" : "Đóng kỳ"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="btn btn-secondary px-3 py-1 text-xs"
        >
          Hủy
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="btn border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
    >
      Đóng kỳ
    </button>
  );
}
