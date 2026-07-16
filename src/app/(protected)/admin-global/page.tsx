import { requireMasterPage } from "@/shared/auth/require-master";
import {
  aiUsageByOrgAction,
  listMastersAction,
} from "@/shared/server/actions/platform/admin";

import { EmptyState, PageHeader, Table } from "../_ui/list";
import { MasterManager } from "./_components/master-manager";

export const dynamic = "force-dynamic";

export default async function AdminGlobalPage() {
  await requireMasterPage();
  const [mastersRes, usageRes] = await Promise.all([
    listMastersAction(),
    aiUsageByOrgAction(),
  ]);

  return (
    <div className="flex flex-col gap-8 px-6 py-8">
      <PageHeader
        title="Administração global"
        description="Área de superadmin da plataforma — cross-tenant. Use com cuidado."
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-text text-sm font-semibold tracking-tight">
          Administradores da plataforma (masters)
        </h2>
        {mastersRes.ok ? (
          <MasterManager masters={mastersRes.data} />
        ) : (
          <EmptyState message="Não foi possível carregar os administradores." />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-text text-sm font-semibold tracking-tight">
          Uso de IA (Anthropic) por organização
        </h2>
        {!usageRes.ok ? (
          <EmptyState message="Não foi possível carregar o uso de IA." />
        ) : usageRes.data.length === 0 ? (
          <EmptyState message="Nenhum uso de IA registrado." />
        ) : (
          <Table headers={["Organização", "org_id", "Chamadas"]}>
            {usageRes.data.map((row) => (
              <tr key={row.orgId} className="border-t border-white/50">
                <td className="px-4 py-2">{row.orgName ?? "—"}</td>
                <td className="px-4 py-2 font-mono text-xs">{row.orgId}</td>
                <td className="px-4 py-2 tabular-nums">{row.count}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <p className="text-text-subtle text-xs">
        Convites de acesso e gestão de guias/conteúdo de onboarding ficam como evolução
        desta área (o manual de onboarding já é um tipo de relatório).
      </p>
    </div>
  );
}
