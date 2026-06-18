"use client";

import { useState, useTransition } from "react";
import { deleteHousehold } from "../actions";

export function DeleteHouseholdButton({
  householdId,
  householdCode,
  residentName,
}: {
  householdId: string;
  householdCode: string;
  residentName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteHousehold(householdId);
      if (result?.error) {
        setError(result.error);
        setConfirming(false);
      }
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

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">
          Xóa vĩnh viễn {householdCode}? Toàn bộ chỉ số/hóa đơn sẽ mất — dùng &quot;Ngưng sử dụng&quot; nếu chỉ
          đóng hộ.
        </span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="btn border border-red-300 bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Đang xóa…" : "Xác nhận xóa"}
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
      className="btn border border-red-200 bg-red-50 text-xs font-semibold text-red-600 hover:bg-red-100"
    >
      Xóa hộ
    </button>
  );
}
