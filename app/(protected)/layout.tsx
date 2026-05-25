import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { OrganizationList } from "@clerk/nextjs";

import {
  NoActiveOrgError,
  UnauthorizedError,
} from "@/lib/auth/errors";
import { getSessionOrNull } from "@/lib/auth/get-session";
import { requireAuth } from "@/lib/auth/require-auth";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      const h = await headers();
      const pathname = h.get("x-pathname") ?? "/dashboard";
      redirect(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
    }
    if (err instanceof NoActiveOrgError) {
      redirect("/sign-in");
    }
    throw err;
  }

  const session = await getSessionOrNull();
  if (!session.orgId) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <OrganizationList
          hidePersonal
          afterCreateOrganizationUrl="/dashboard"
          afterSelectOrganizationUrl="/dashboard"
        />
      </main>
    );
  }

  return <>{children}</>;
}
