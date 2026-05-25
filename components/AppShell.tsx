import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { appTitle, userRoleLabel } from "@/lib/vi";
import { AppNav } from "@/components/AppNav";
import { LogoutButton } from "@/components/LogoutButton";

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
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-14 items-center gap-3 sm:gap-4">
            <Link
              href="/"
              className="group flex shrink-0 items-center gap-2.5 sm:gap-3"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-white shadow-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
              </span>
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
              className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Menu chính"
            >
              <AppNav items={nav} />
            </nav>

            <div className="flex shrink-0 items-center gap-1.5 border-l border-[var(--border)] pl-2 sm:gap-2 sm:pl-3">
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
      <main className="mx-auto w-full max-w-7xl px-4 py-7">{children}</main>
    </div>
  );
}
