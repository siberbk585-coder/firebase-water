"use client";

import { useEffect, useRef, useState } from "react";
import { createHousehold } from "@/app/admin/households/actions";

type RouteOption = { id: string; name: string };

export function AddHouseholdModal({ routes }: { routes: RouteOption[] }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="btn btn-primary shrink-0"
        onClick={() => setOpen(true)}
      >
        + Thêm hộ
      </button>

      <dialog
        ref={dialogRef}
        className="w-[min(100%,32rem)] max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-0 shadow-xl backdrop:bg-black/40 mx-auto my-auto"
        onClose={() => setOpen(false)}
      >
        <form action={createHousehold} className="flex flex-col">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-lg font-bold">Thêm hộ mới</h2>
            <p className="text-xs text-[var(--muted)]">
              Mã hộ và đồng hồ không trùng với hộ đã có. Tài khoản app là tùy chọn.
            </p>
          </div>

          <div className="max-h-[min(70vh,28rem)] space-y-3 overflow-y-auto px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label mb-0 text-xs" htmlFor="hh-code">
                  Mã hộ (MKH)
                </label>
                <input
                  id="hh-code"
                  name="householdCode"
                  className="input w-full py-1.5 font-mono uppercase"
                  placeholder="212099"
                  required
                />
              </div>
              <div>
                <label className="label mb-0 text-xs" htmlFor="hh-meter">
                  Mã đồng hồ
                </label>
                <input
                  id="hh-meter"
                  name="meterCode"
                  className="input w-full py-1.5 font-mono uppercase"
                  placeholder="DH00999"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label mb-0 text-xs" htmlFor="hh-route">
                Khu vực thu <span className="text-red-500">*</span>
              </label>
              <select
                id="hh-route"
                name="collectionRouteId"
                className="input w-full py-1.5"
                defaultValue=""
                required
              >
                <option value="" disabled>— Chọn khu vực —</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label mb-0 text-xs" htmlFor="hh-name">
                Chủ hộ
              </label>
              <input
                id="hh-name"
                name="residentName"
                className="input w-full py-1.5"
                required
              />
            </div>

            <div>
              <label className="label mb-0 text-xs" htmlFor="hh-address">
                Địa chỉ
              </label>
              <input
                id="hh-address"
                name="address"
                className="input w-full py-1.5"
                required
              />
            </div>

            <div>
              <label className="label mb-0 text-xs" htmlFor="hh-phone">
                SĐT liên hệ
              </label>
              <input
                id="hh-phone"
                name="contactPhone"
                className="input w-full py-1.5"
                placeholder="Tùy chọn"
              />
            </div>

            <fieldset className="rounded-lg border border-[var(--border)] bg-slate-50/80 px-3 py-2">
              <legend className="px-1 text-xs font-semibold text-[var(--muted)]">
                Tài khoản app (tùy chọn)
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="label mb-0 text-xs" htmlFor="hh-app-phone">
                    SĐT đăng nhập
                  </label>
                  <input
                    id="hh-app-phone"
                    name="appPhone"
                    className="input w-full py-1.5"
                    placeholder="09xxxxxxxx"
                  />
                </div>
                <div>
                  <label className="label mb-0 text-xs" htmlFor="hh-app-pw">
                    Mật khẩu
                  </label>
                  <input
                    id="hh-app-pw"
                    name="appPassword"
                    type="password"
                    className="input w-full py-1.5"
                    placeholder="Mặc định 123456"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </fieldset>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setOpen(false)}
            >
              Hủy
            </button>
            <button type="submit" className="btn btn-primary">
              Lưu hộ mới
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
