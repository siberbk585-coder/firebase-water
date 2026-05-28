"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SubmitReadingClient({
  periodId,
  oldReading,
  initialCsm = "",
  canSubmit = true,
  submitBlockedReason,
}: {
  periodId: string;
  oldReading: number;
  initialCsm?: string;
  canSubmit?: boolean;
  submitBlockedReason?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(() => initialCsm ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit() {
    const confirmedValue = parseFloat(value);
    if (Number.isNaN(confirmedValue) || confirmedValue <= 0) {
      setError("Nhập CSM hợp lệ (số dương).");
      return;
    }
    if (confirmedValue < oldReading) {
      setError(`CSM phải ≥ CSC (${oldReading}).`);
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const fd = new FormData();
      fd.append("periodId", periodId);
      fd.append("confirmedValue", String(confirmedValue));

      const res = await fetch("/api/readings/submit", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Không lưu được");
        return;
      }
      router.refresh();
      setValue("");
      setSuccess("Đã gửi chỉ số. Chờ tổ trưởng/kế toán chốt tháng này.");
    } catch {
      setError("Lỗi kết nối. Thử lại.");
    } finally {
      setLoading(false);
    }
  }

  if (!canSubmit) {
    return (
      <div className="card">
        <p className="text-sm text-[var(--muted)]">
          {submitBlockedReason ??
            "Bạn đã gửi và chỉ số đã được chốt, hoặc kỳ đã đóng. Không thể gửi thêm từ trang này."}
        </p>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <p className="rounded-lg bg-[var(--primary-soft)] px-3 py-2 text-sm text-[var(--primary-dark)]">
        Chỉ số cũ (CSC) kỳ trước: <strong>{oldReading} m³</strong>
      </p>

      <div>
        <label className="label" htmlFor="csm-input">
          Chỉ số mới — CSM (m³)
        </label>
        <input
          id="csm-input"
          className="input"
          type="number"
          step="0.01"
          min={oldReading}
          placeholder={`Ví dụ: ${oldReading + 10}`}
          value={value ?? ""}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>

      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={!value || loading}
        onClick={submit}
      >
        {loading ? "Đang lưu..." : "Gửi chỉ số"}
      </button>

      {success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</p>
      )}
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}
