import { forbidden } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { formatInstantDate } from "@/shared/dates";
import { ACCESS_AREA_LABELS } from "@/shared/domains/platform/access-scopes";
import { PAGE_SIZE_MAX } from "@/shared/pagination";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";
import { listAccessScopesAction } from "@/shared/server/actions/platform/access-scopes";
import { listTeamMembers } from "@/shared/server/actions/platform/team";

import { FormError } from "../../../_ui/form";
import { PageHeader, Table } from "../../../_ui/list";
import { GrantScopeForm } from "./_components/grant-scope-form";
import { RevokeScope } from "./_components/revoke-scope";

export const dynamic = "force-dynamic";

const UNRESTRICTED_NOTICE =
  "Sem nenhum escopo, este membro acessa todas as empresas, obras e áreas do escritório. O primeiro escopo concedido passa a limitar o acesso ao que estiver listado.";
const RESTRICTED_NOTICE =
  "Este membro só acessa o que está listado abaixo. Ao remover o último escopo, ele volta a acessar todas as empresas, obras e áreas.";

export default async function MemberAccessPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const ctx = await requireOfficeStaffPage();
  if (ctx.role !== "owner") forbidden();
  const { userId } = await params;
  const [scopes, companies, team] = await Promise.all([
    listAccessScopesAction(userId),
    listCompanyOptionsAction(),
    listTeamMembers({ pageSize: PAGE_SIZE_MAX }),
  ]);
  const member = team.ok ? team.data.rows.find((row) => row.userId === userId) : null;
  const rows = scopes.ok ? scopes.data : [];
  const companyOptions = companies.ok
    ? companies.data.map((company) => ({
        value: company.id,
        label: company.razaoSocial,
      }))
    : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`Acessos de ${member?.name ?? "membro da equipe"}`}
        description="Empresas, obras e áreas que este membro pode acessar."
        backHref="/team"
      />

      {scopes.ok ? (
        <p role="status" className="glass-card text-text-muted px-4 py-3 text-sm">
          {rows.length === 0 ? UNRESTRICTED_NOTICE : RESTRICTED_NOTICE}
        </p>
      ) : (
        <FormError message={scopes.error.message} />
      )}

      <GrantScopeForm userId={userId} companies={companyOptions} />

      {rows.length === 0 ? null : (
        <Table headers={["Empresa", "Obra", "Área", "Concedido em", ""]}>
          {rows.map((scope) => (
            <tr key={scope.id}>
              <td className="px-4 py-2 font-medium sm:px-6">{scope.companyName}</td>
              <td className="px-4 py-2 sm:px-6">
                {scope.workUnitName ?? "Todas as obras"}
              </td>
              <td className="px-4 py-2 sm:px-6">{ACCESS_AREA_LABELS[scope.area]}</td>
              <td className="px-4 py-2 sm:px-6">{formatInstantDate(scope.grantedAt)}</td>
              <td className="px-4 py-2 sm:px-6">
                <div className="flex justify-end">
                  <RevokeScope userId={userId} scopeId={scope.id} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
