import { redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";

import { requireOrgContext } from "@/lib/auth/require-org-context";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireOrgContext();
  const client = await clerkClient();

  let orgName: string;
  try {
    const org = await client.organizations.getOrganization({
      organizationId: ctx.orgId,
    });
    orgName = org.name;
  } catch {
    redirect("/sign-in");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Bem-vindo ao SST Manager</h1>
      <p className="text-lg text-zinc-600">
        Organização ativa: <strong>{orgName}</strong>
      </p>
      <p className="max-w-md text-sm text-zinc-600">
        Fatia fundacional — área autenticada. Módulos de negócio chegam nas próximas
        entregas.
      </p>
    </main>
  );
}
