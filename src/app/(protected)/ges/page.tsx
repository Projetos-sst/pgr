import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { riskAgentTypeLabel, type RiskAgentType } from "@/shared/domains/pgr/risks";
import { resolvePageParams } from "@/shared/pagination";
import { listGesAction } from "@/shared/server/actions/pgr/ges";

import {
  EmptyState,
  ListCard,
  ListToolbar,
  PageHeader,
  Pagination,
  Table,
  ToolbarPrimaryLink,
  ToolbarSearch,
} from "../_ui/list";
import { EditRowAction, RowActions } from "../_ui/row-actions";
import { DeleteGes } from "./_components/delete-ges";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  search?: string;
  page?: string;
  companyId?: string;
  workUnitId?: string;
}>;

/** Cor por agente de risco — paleta ampliada além dos 5 tons de `StatusPill`. */
const RISK_BADGE_CLASS: Record<RiskAgentType, string> = {
  physical: "bg-primary/12 text-primary",
  chemical: "bg-violet-500/14 text-violet-700",
  biological: "bg-accent-green/14 text-accent-green",
  ergonomic: "bg-sky-500/14 text-sky-700",
  mechanical: "bg-accent-amber/16 text-accent-amber-strong",
  accident: "bg-accent-amber/16 text-accent-amber-strong",
  psychosocial: "bg-pink-500/14 text-pink-700",
};

function GesIcon() {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <circle cx="7" cy="8" r="3" />
      <circle cx="17" cy="8" r="3" />
      <path d="M2 20a5 5 0 0 1 10 0M12 20a5 5 0 0 1 10 0" />
    </svg>
  );
}

export default async function GesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listGesAction({
    search: sp.search,
    companyId: sp.companyId,
    workUnitId: sp.workUnitId,
    page,
  });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-[22px] px-6 pt-8 pb-10 sm:px-[30px]">
      <PageHeader
        icon={<GesIcon />}
        title="GES — Grupos de Exposição Similar"
        description={`${total} ${total === 1 ? "grupo ativo" : "grupos ativos"} · agrupam funções por perfil de risco`}
      />

      <ListCard>
        <ListToolbar action="/ges">
          {sp.companyId ? (
            <input type="hidden" name="companyId" value={sp.companyId} />
          ) : null}
          {sp.workUnitId ? (
            <input type="hidden" name="workUnitId" value={sp.workUnitId} />
          ) : null}
          <ToolbarSearch
            label="Buscar GES"
            placeholder="Buscar por GES, setor ou empresa…"
            defaultValue={sp.search}
          />
          <ToolbarPrimaryLink href="/ges/new">Novo GES</ToolbarPrimaryLink>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-4 sm:p-6">
            <EmptyState
              title="Nenhum GES encontrado"
              message="Nenhum grupo de exposição similar foi encontrado para os filtros selecionados."
            />
          </div>
        ) : (
          <>
            <Table
              embedded
              headers={["Código", "Setor", "Empresa", "Funcion.", "Riscos", "Opç."]}
            >
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="text-primary px-4 py-3.5 font-mono font-bold sm:px-6">
                    <Link href={`/ges/${row.id}/edit`} className="hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="text-text px-4 py-3.5 font-semibold sm:px-6">
                    {row.processDescription ?? "—"}
                  </td>
                  <td className="text-text px-4 py-3.5 sm:px-6">
                    {row.companyName ?? "—"}
                  </td>
                  <td className="text-text px-4 py-3.5 font-semibold sm:px-6">
                    {row.exposedWorkers}
                  </td>
                  <td className="px-4 py-3.5 sm:px-6">
                    <div className="flex flex-wrap gap-1.5">
                      {row.risks.length > 0 ? (
                        row.risks.map((riskType) => (
                          <span
                            key={riskType}
                            className={`rounded-pill px-2.5 py-0.5 text-[10px] font-bold ${RISK_BADGE_CLASS[riskType]}`}
                          >
                            {riskAgentTypeLabel(riskType)}
                          </span>
                        ))
                      ) : (
                        <span className="text-text-subtle text-[11px]">Sem riscos</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 sm:px-6">
                    <RowActions>
                      <EditRowAction href={`/ges/${row.id}/edit`} label="Gerenciar GES" />
                      <DeleteGes id={row.id} />
                    </RowActions>
                  </td>
                </tr>
              ))}
            </Table>

            <Pagination
              basePath="/ges"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{
                search: sp.search,
                companyId: sp.companyId,
                workUnitId: sp.workUnitId,
              }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
