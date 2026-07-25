import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { NoTenantContextError, UnauthorizedError } from "@/shared/auth/errors";
import { requireTenantContext } from "@/shared/auth/require-tenant-context";

import { TenantSwitcher } from "../_components/tenant-switcher";
import { UserProfilePill } from "./_components/user-profile-pill";
import { NavMenu } from "./_components/nav-menu";
import { NotificationsBell } from "./_ui/notifications-bell";

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
      <header className="sticky top-0 z-40 flex h-[72px] items-center gap-5 border-b border-white/55 bg-white/42 px-5 saturate-[180%] backdrop-blur-[34px] sm:gap-6 sm:px-8">
        <Link
          href="/welcome"
          className="group flex shrink-0 items-center gap-2.5 transition-transform duration-200 active:scale-95"
        >
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-[#5b63f5] text-sm font-extrabold text-white shadow-[0_4px_14px_rgba(91,99,245,0.4)] transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_6px_20px_rgba(91,99,245,0.6)]">
            S
          </span>
          <span className="hidden text-base font-extrabold tracking-tight text-[#1b1f2e] transition-colors duration-200 group-hover:text-[#5b63f5] sm:inline">
            SST Manager
          </span>
        </Link>
        <NavMenu />
        <div className="ml-auto flex items-center gap-3">
          <TenantSwitcher />
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
