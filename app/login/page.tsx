import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 pb-10 pt-[calc(2.5rem+var(--app-safe-top))]">
      <div className="card w-full max-w-md border-white/80 bg-white/90 backdrop-blur">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 text-2xl font-bold text-[var(--foreground)]">Đăng nhập</h1>
            <p className="text-sm text-[var(--muted)]">Ứng dụng thu tiền nước hàng tháng</p>
          </div>
          <span className="rounded-lg bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary-dark)]">
            BQL
          </span>
        </div>
        <LoginForm />
        <p className="mt-4 rounded-lg bg-[var(--card-muted)] p-3 text-xs leading-5 text-[var(--muted)]">
          Demo: Quản trị admin / 123456 — Hộ dân 0912345678 / 123456
        </p>
      </div>
    </div>
  );
}
