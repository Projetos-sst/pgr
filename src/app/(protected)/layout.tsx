import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { NoTenantContextError, UnauthorizedError } from "@/shared/auth/errors";
import { requireTenantContext } from "@/shared/auth/require-tenant-context";

import { TenantSwitcher } from "../_components/tenant-switcher";
import { UserProfilePill } from "./_components/user-profile-pill";
import { NavMenu } from "./_components/nav-menu";
import { NotificationsBell } from "./_ui/notifications-bell";
import { HeaderActions } from "./_components/header-actions";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireTenantContext();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      const h = await headers();
      const pathname = h.get("x-pathname") ?? "/dashboard";
      redirect(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
    }
    if (err instanceof NoTenantContextError) {
      redirect("/sign-in");
    }
    throw err;
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-40 flex h-[72px] w-full max-w-full items-center justify-between gap-1.5 border-b border-white/55 bg-white/42 px-2.5 saturate-[180%] backdrop-blur-[34px] sm:gap-4 sm:px-6 xl:gap-6 xl:px-8">
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-4 xl:gap-6">
          <Link
            href="/welcome"
            className="group flex shrink-0 items-center gap-2.5 transition-transform duration-200 active:scale-95"
          >
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-[#5b63f5] text-sm font-extrabold text-white shadow-[0_4px_14px_rgba(91,99,245,0.4)] transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_6px_20px_rgba(91,99,245,0.6)]">
              P
            </span>
            <span className="hidden text-base font-extrabold tracking-tight text-[#1b1f2e] transition-colors duration-200 group-hover:text-[#5b63f5] sm:inline">
              PGR-e
            </span>
          </Link>
          <NavMenu />
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <div className="flex items-center gap-1">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="hidden text-[#5b63f5] sm:block"
            >
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
              <line x1="9" y1="6" x2="9" y2="6.01" />
              <line x1="15" y1="6" x2="15" y2="6.01" />
              <line x1="9" y1="10" x2="9" y2="10.01" />
              <line x1="15" y1="10" x2="15" y2="10.01" />
              <line x1="9" y1="14" x2="9" y2="14.01" />
              <line x1="15" y1="14" x2="15" y2="14.01" />
              <line x1="9" y1="18" x2="15" y2="18" />
            </svg>
            <TenantSwitcher />
          </div>
          <div className="hidden items-center md:flex">
            <HeaderActions />
          </div>
          <NotificationsBell />
          <UserProfilePill />
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-[1320px] flex-1">{children}</div>
      </main>
    </div>
  );
}
