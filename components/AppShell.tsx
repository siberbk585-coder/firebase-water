import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { appTitle, userRoleLabel } from "@/lib/vi";
import { AppMobileNav, AppNav } from "@/components/AppNav";
import { BrandLogo } from "@/components/BrandLogo";
import { LogoutButton } from "@/components/LogoutButton";

const ADMIN_MOBILE_NAV = new Set([
  "/admin/dashboard",
  "/admin/billing-sheet",
  "/admin/payments",
  "/admin/households",
]);

export function AppShell({
  user,
  children,
  nav,
  headerActions,
}: {
  user: SessionUser;
  children: React.ReactNode;
  nav: { href: string; label: string }[];
  headerActions?: React.ReactNode;
}) {
  const mobileNav =
    user.role === "ADMIN" ? nav.filter((item) => ADMIN_MOBILE_NAV.has(item.href)) : nav;

  return (
    <div className="min-h-screen">
      <header className="app-header sticky z-30 border-b border-[var(--border)] bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="mx-auto max-w-7xl px-3 sm:px-4">
          <div className="flex h-14 items-center gap-2 sm:gap-4">
            <Link
              href="/"
              className="group flex shrink-0 items-center gap-2.5 sm:gap-3"
            >
              <BrandLogo
                size={32}
                iconOnly
                className="shrink-0 rounded-xl border border-[var(--border)] bg-white p-1 shadow-sm"
              />
              <span className="hidden leading-tight sm:block">
                <span className="block text-sm font-semibold tracking-tight text-[var(--foreground)]">
                  {appTitle}
                </span>
                <span className="block max-w-[11rem] truncate text-xs text-[var(--muted)] group-hover:text-[var(--foreground)] md:max-w-none">
                  Ghi số · Hóa đơn · Thu tiền
                </span>
              </span>
              <span className="text-sm font-semibold sm:hidden">{appTitle}</span>
            </Link>

            <nav
              className="hidden min-w-0 flex-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] lg:block [&::-webkit-scrollbar]:hidden"
              aria-label="Menu chính"
            >
              <AppNav items={nav} />
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-1.5 border-l border-[var(--border)] pl-2 sm:gap-2 sm:pl-3">
              {headerActions}
              <div className="hidden text-right lg:block">
                <div className="max-w-[8rem] truncate text-sm font-semibold text-[var(--foreground)] xl:max-w-[10rem]">
                  {user.name}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {userRoleLabel(user.role)}
                </div>
              </div>
              <LogoutButton className="btn btn-secondary shrink-0 whitespace-nowrap px-2.5 py-1.5 text-xs font-semibold sm:px-3 sm:text-sm" />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-3 py-4 pb-24 sm:px-4 sm:py-7 md:pb-7">
        {children}
      </main>
      <AppMobileNav items={mobileNav} />
    </div>
  );
}
