"use client";

import { useState, useTransition } from "react";
import { deactivateHousehold, reactivateHousehold } from "../actions";

export function HouseholdStatusActions({
  householdId,
  householdCode,
  residentName,
  status,
  inactiveFromLabel,
}: {
  householdId: string;
  householdCode: string;
  residentName: string;
  status: string;
  inactiveFromLabel: string | null;
}) {
  const [mode, setMode] = useState<"deactivate" | "reactivate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isActive = status === "ACTIVE";

  function run(action: "deactivate" | "reactivate") {
    setError(null);
    startTransition(async () => {
      const result =
        action === "deactivate"
          ? await deactivateHousehold(householdId)
          : await reactivateHousehold(householdId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setMode(null);
    });
  }

  if (error) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-red-600">{error}</span>
        <button
          type="button"
          onClick={() => setError(null)}
          className="text-xs text-slate-500 underline"
        >
          Đóng
        </button>
      </div>
    );
  }

  if (mode === "deactivate") {
    return (
      <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950">
        <p className="mb-2 leading-5">
          <strong>Ngưng sử dụng</strong> hộ <strong>{householdCode}</strong> ({residentName})?
          Hộ vẫn thu nước <strong>tháng hiện tại</strong> lần cuối; từ tháng sau không hiện trên
          bảng kê. Dữ liệu cũ được giữ — khác với xóa hộ.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => run("deactivate")}
            disabled={pending}
            className="btn border border-amber-400 bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {pending ? "Đang lưu…" : "Xác nhận ngưng"}
          </button>
          <button
            type="button"
            onClick={() => setMode(null)}
            disabled={pending}
            className="btn btn-secondary px-3 py-1 text-xs"
          >
            Hủy
          </button>
        </div>
      </div>
    );
  }

  if (mode === "reactivate") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-600">
          Kích hoạt lại {householdCode}?
          {inactiveFromLabel ? ` (đã ${inactiveFromLabel.toLowerCase()})` : ""}
        </span>
        <button
          type="button"
          onClick={() => run("reactivate")}
          disabled={pending}
          className="btn border border-emerald-300 bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? "Đang lưu…" : "Xác nhận"}
        </button>
        <button
          type="button"
          onClick={() => setMode(null)}
          disabled={pending}
          className="btn btn-secondary px-3 py-1 text-xs"
        >
          Hủy
        </button>
      </div>
    );
  }

  if (isActive) {
    return (
      <button
        type="button"
        onClick={() => setMode("deactivate")}
        className="btn border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-800 hover:bg-amber-100"
      >
        Ngưng sử dụng
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setMode("reactivate")}
      className="btn border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
    >
      Kích hoạt lại
    </button>
  );
}
