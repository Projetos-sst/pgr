import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { UserButton } from "@clerk/nextjs";

import { NoTenantContextError, UnauthorizedError } from "@/shared/auth/errors";
import { requireTenantContext } from "@/shared/auth/require-tenant-context";

import { TenantSwitcher } from "../_components/tenant-switcher";
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
      <header className="app-nav flex h-[72px] items-center gap-4 px-5 sm:gap-6 sm:px-8">
        <Link href="/boas-vindas" className="flex shrink-0 items-center gap-2.5">
          <span className="btn-primary flex h-[34px] w-[34px] items-center justify-center rounded-[11px] text-sm font-extrabold">
            S
          </span>
          <span className="text-text hidden text-base font-extrabold tracking-tight sm:inline">
            SST Manager
          </span>
        </Link>
        <NavMenu />
        <div className="ml-auto flex items-center gap-3">
          <NotificationsBell />
          <TenantSwitcher />
          <UserButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-[1320px] flex-1">{children}</div>
      </main>
    </div>
  );
}
