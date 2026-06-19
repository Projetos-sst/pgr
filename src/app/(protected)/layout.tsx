import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { OrganizationSwitcher } from "@clerk/nextjs";

import { NoTenantContextError, UnauthorizedError } from "@/shared/auth/errors";
import { requireTenantContext } from "@/shared/auth/require-tenant-context";

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
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-end border-b border-black/10 px-6 py-3 dark:border-white/10">
        <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/dashboard" />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
