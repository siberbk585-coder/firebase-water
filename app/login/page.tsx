import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { appTitle } from "@/lib/vi";
import { BrandLogo } from "@/components/BrandLogo";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="login-page relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-[-6rem] h-72 w-72 rounded-full bg-[#6f9ee8]/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-[-4rem] h-80 w-80 rounded-full bg-[var(--primary)]/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-[#42cba5]/15 blur-3xl"
      />

      <div className="relative flex min-h-screen items-center justify-center px-4 py-10 pt-[calc(2.5rem+var(--app-safe-top))]">
        <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-14">
          <section className="hidden text-center lg:block lg:text-left">
            <BrandLogo size={96} iconOnly className="mx-auto lg:mx-0" />
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-[var(--foreground)]">
              {appTitle}
            </h1>
            <p className="mt-3 max-w-md text-base leading-relaxed text-[var(--muted)]">
              Ghi chỉ số, lập hóa đơn và theo dõi thu tiền nước hàng tháng — mọi thứ trên một nền tảng.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-[var(--muted)]">
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--primary-soft)] text-[var(--primary-dark)]">
                  ✓
                </span>
                Bảng thu nước trực tuyến
              </li>
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--primary-soft)] text-[var(--primary-dark)]">
                  ✓
                </span>
                Hóa đơn &amp; in phiếu thu
              </li>
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--primary-soft)] text-[var(--primary-dark)]">
                  ✓
                </span>
                Quản lý hộ dân &amp; người thu
              </li>
            </ul>
          </section>

          <section className="login-card w-full justify-self-center">
            <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
              <BrandLogo size={100} className="lg:hidden" />
              <p className="mt-4 text-sm font-medium text-[var(--primary-dark)] lg:mt-0">
                Chào mừng trở lại
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--foreground)]">
                Đăng nhập
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Ứng dụng thu tiền nước hàng tháng
              </p>
            </div>

            <LoginForm />

            <p className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--card-muted)]/80 px-3.5 py-3 text-xs leading-5 text-[var(--muted)]">
              Admin, người thu (tên đăng nhập) hoặc hộ dân (SĐT) — mật khẩu do quản trị cấp.
            </p>

            <p className="mt-6 text-center text-[11px] text-[var(--muted)]/80">
              tiennuoc.web.app
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
