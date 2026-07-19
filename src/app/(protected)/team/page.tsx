import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { ROLE_LABEL, type AssignableRole } from "@/shared/domains/platform/team";
import { resolvePageParams } from "@/shared/pagination";
import { listTeamMembers } from "@/shared/server/actions/platform/team";
import { isTeamManagementAvailable } from "@/shared/tenant/plan";

import { EmptyState, PageHeader, Pagination, SearchForm, Table } from "../_ui/list";
import { InviteMemberForm, MemberActions } from "./_components/team-actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ search?: string; page?: string }>;

export default async function EquipePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await requireOfficeStaffPage();
  const isOwner = ctx.role === "owner";
  const isPro = isTeamManagementAvailable(ctx.plan);
  // Gestão de equipe (dropdown de papel + remoção) é PRO — esconder na UI para
  // owners de plano free, não só deixar a Server Action falhar (FORBIDDEN).
  const canManage = isOwner && isPro;

  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listTeamMembers({ search: sp.search, page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  const headers = ["Membro", "E-mail", "Cargo", "Papel"];
  if (canManage) headers.push("");

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Equipe"
        description="Membros do escritório e seus papéis nesta organização."
      />

      {isOwner && isPro ? <InviteMemberForm /> : null}
      {isOwner && !isPro ? (
        <p className="glass-card text-text-muted px-4 py-3 text-sm">
          A gestão de múltiplos usuários (convite de membros) está disponível no plano
          Pro.
        </p>
      ) : null}

      <SearchForm
        basePath="/team"
        placeholder="Buscar por nome, e-mail ou cargo"
        defaultValue={sp.search}
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhum membro encontrado." />
      ) : (
        <Table headers={headers}>
          {rows.map((member) => (
            <tr key={member.userId} className="border-t border-white/50">
              <td className="px-4 py-2 font-medium">{member.name}</td>
              <td className="px-4 py-2">{member.email ?? "—"}</td>
              <td className="px-4 py-2">{member.jobTitle ?? "—"}</td>
              <td className="px-4 py-2">
                {ROLE_LABEL[member.role as AssignableRole] ?? member.roleLabel}
              </td>
              {canManage ? (
                <td className="px-4 py-2">
                  <MemberActions
                    userId={member.userId}
                    role={member.role}
                    isSelf={member.userId === ctx.userId}
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/team"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ search: sp.search }}
      />
    </div>
  );
}
