import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listRisksAction } from "@/shared/server/actions/pgr/risks";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";
import { riskAgentTypeLabel, exposureTimeLabel } from "@/shared/domains/pgr/risks";

import { EmptyState, PageHeader, Pagination, PrimaryLink, Table } from "../_ui/list";
import { RiskFilters } from "./_components/risk-filters";
import { DeleteRisk } from "./_components/delete-risk";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  page?: string;
  companyId?: string;
  workUnitId?: string;
  gesId?: string;
}>;

export default async function RisksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const [result, companyOptions] = await Promise.all([
    listRisksAction({
      companyId: sp.companyId,
      workUnitId: sp.workUnitId,
      gesId: sp.gesId,
      page,
    }),
    listCompanyOptionsAction(),
  ]);
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const companies = companyOptions.ok ? companyOptions.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Riscos"
        description="Inventário de riscos por Grupo de Exposição Similar (NR-01/GRO)."
        action={<PrimaryLink href="/risks/new">Novo risco</PrimaryLink>}
      />

      <RiskFilters
        companies={companies}
        companyId={sp.companyId}
        workUnitId={sp.workUnitId}
        gesId={sp.gesId}
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhum risco encontrado. Cadastre o primeiro risco de um GES." />
      ) : (
        <Table
          headers={["Grupo do agente", "Descrição", "Tempo de exposição", "GES", ""]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2">
                <Link href={`/risks/${row.id}`} className="font-medium hover:underline">
                  {riskAgentTypeLabel(row.agentType)}
                </Link>
              </td>
              <td className="px-4 py-2">{row.description}</td>
              <td className="px-4 py-2">
                {row.exposureTime ? exposureTimeLabel(row.exposureTime) : "—"}
              </td>
              <td className="px-4 py-2">{row.gesName}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/risks/${row.id}/edit`}
                    className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
                  >
                    Editar
                  </Link>
                  <DeleteRisk id={row.id} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/risks"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{
          companyId: sp.companyId,
          workUnitId: sp.workUnitId,
          gesId: sp.gesId,
        }}
      />
    </div>
  );
}
