"use client";

import { useState, useTransition } from "react";
import { deactivateCollector, reactivateCollector } from "./actions";

export function CollectorStatusButton({
  collectorId,
  username,
  isActive,
}: {
  collectorId: string;
  username: string | null;
  isActive: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const result = isActive
        ? await deactivateCollector(collectorId)
        : await reactivateCollector(collectorId);
      if (result?.error) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      setConfirming(false);
    });
  }

  if (error) {
    return (
      <span className="text-xs text-red-600">
        {error}{" "}
        <button type="button" className="underline" onClick={() => setError(null)}>
          Đóng
        </button>
      </span>
    );
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-600">
          {isActive ? "Đóng" : "Mở lại"} tài khoản <strong>{username}</strong>?
        </span>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className={[
            "btn px-3 py-1 text-xs font-bold text-white",
            isActive ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700",
          ].join(" ")}
        >
          {pending ? "Đang lưu…" : "Xác nhận"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
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
      className={[
        "btn text-xs font-semibold",
        isActive
          ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
      ].join(" ")}
    >
      {isActive ? "Đóng tài khoản" : "Mở lại tài khoản"}
    </button>
  );
}
