"use client";

import { resetCollectorPassword } from "./actions";

export function ResetCollectorPasswordForm({
  collectorId,
}: {
  collectorId: string;
}) {
  const action = resetCollectorPassword.bind(null, collectorId);

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Chỉ quản trị viên được đặt lại mật khẩu đăng nhập app cho thu hộ.
      </p>
      <div>
        <label className="label" htmlFor="collector-new-password">
          Mật khẩu mới
        </label>
        <input
          id="collector-new-password"
          name="password"
          type="password"
          minLength={6}
          required
          autoComplete="new-password"
          className="input w-full max-w-sm"
        />
      </div>
      <div>
        <label className="label" htmlFor="collector-new-password-confirm">
          Nhập lại mật khẩu
        </label>
        <input
          id="collector-new-password-confirm"
          name="passwordConfirm"
          type="password"
          minLength={6}
          required
          autoComplete="new-password"
          className="input w-full max-w-sm"
        />
      </div>
      <button type="submit" className="btn btn-secondary">
        Đổi mật khẩu
      </button>
    </form>
  );
}
