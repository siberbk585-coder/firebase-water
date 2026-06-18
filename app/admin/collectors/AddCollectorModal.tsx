"use client";

import { useState } from "react";
import { createCollector } from "./actions";

type RouteOption = { id: string; name: string };

export function AddCollectorModal({ routes }: { routes: RouteOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        + Tài khoản thu hộ
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto">
            <h2 className="mb-4 text-lg font-bold">Thêm người thu</h2>
            <form action={createCollector} className="space-y-4">
              <div>
                <label className="label" htmlFor="collector-username">
                  Tên đăng nhập
                </label>
                <input
                  id="collector-username"
                  name="username"
                  className="input"
                  placeholder="vd. thu_kv1"
                  autoComplete="off"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="collector-name">
                  Họ tên
                </label>
                <input id="collector-name" name="name" className="input" required />
              </div>
              <div>
                <label className="label" htmlFor="collector-password">
                  Mật khẩu
                </label>
                <input
                  id="collector-password"
                  name="password"
                  type="password"
                  className="input"
                  minLength={6}
                  autoComplete="new-password"
                  required
                />
              </div>
              <fieldset>
                <legend className="label mb-2">Khu vực được thu</legend>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                  {routes.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="routeIds" value={r.id} className="rounded" />
                      <span>{r.name}</span>
                    </label>
                  ))}
                  {!routes.length && (
                    <p className="text-sm text-[var(--muted)]">Chưa có khu vực thu.</p>
                  )}
                </div>
              </fieldset>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setOpen(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={!routes.length}>
                  Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
