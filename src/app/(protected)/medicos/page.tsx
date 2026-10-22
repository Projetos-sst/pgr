import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { MEDICO_STATUS_LABELS } from "@/shared/domains/pgr/medicos";
import {
  listMedicosAction,
  listMedicoClinicsAction,
} from "@/shared/server/actions/pgr/medicos";

import { EmptyState, PageHeader } from "../_ui/list";
import {
  Cell,
  DataGrid,
  GridHeader,
  GridRow,
  ListCard,
  ListFooter,
  ListToolbar,
  MonoCell,
  StatusBadge,
  ToolbarButton,
  ToolbarSearch,
  ViewIcon,
} from "../_ui/data-list";
import { ListErrorState, hrefWithParams } from "../_ui/list-error-state";
import { DeleteMedico } from "./_components/delete-medico";
import { MedicoFilters } from "./_components/medico-filters";
import { MedicoIcon } from "./_components/medico-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "1.1fr 1.7fr 1.1fr 1.2fr 1.1fr 1fr 84px";

type SearchParams = Promise<{ search?: string; clinic?: string; page?: string }>;

export default async function MedicosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const [result, clinicsResult] = await Promise.all([
    listMedicosAction({ search: sp.search, clinic: sp.clinic, page }),
    listMedicoClinicsAction(),
  ]);
  const retryHref = hrefWithParams("/medicos", {
    search: sp.search,
    clinic: sp.clinic,
    page: sp.page,
  });

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<MedicoIcon />}
        title="Médicos"
        description="Médicos do trabalho responsáveis por exames e ASOs"
      />

      <ListCard>
        <ListToolbar>
          {clinicsResult.ok ? (
            <MedicoFilters
              basePath="/medicos"
              search={sp.search}
              clinic={sp.clinic}
              clinics={clinicsResult.data}
            />
          ) : (
            // Opções de clínica não carregaram: só a busca (a clínica ativa segue
            // como filtro oculto) + aviso curto. A lista não é afetada.
            <>
              <ToolbarSearch
                basePath="/medicos"
                placeholder="Buscar por nome ou CRM…"
                defaultValue={sp.search}
                hidden={{ clinic: sp.clinic }}
              />
              <span role="status" className="text-text-subtle text-[12px] font-semibold">
                Filtro de clínica indisponível
              </span>
            </>
          )}
          <ToolbarButton href="/medicos/new">Novo Médico</ToolbarButton>
        </ListToolbar>

        {!result.ok ? (
          <ListErrorState
            isFlat
            code={result.error.code}
            title="Não foi possível carregar os médicos"
            description="Isso não significa que não haja médicos cadastrados. Tente novamente."
            retryHref={retryHref}
          />
        ) : result.data.rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              isFlat
              message={
                sp.search || sp.clinic
                  ? "Nenhum médico encontrado para os filtros."
                  : "Nenhum médico cadastrado."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={900}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "CRM" },
                  { header: "Nome" },
                  { header: "Especialidade" },
                  { header: "Empresa" },
                  { header: "Telefone" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {result.data.rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <MonoCell href={`/medicos/${row.id}/edit`}>{row.crm}</MonoCell>
                  <Cell className="text-text font-semibold">{row.name}</Cell>
                  <Cell className={row.specialty ? undefined : "text-text-subtle"}>
                    {row.specialty ?? "—"}
                  </Cell>
                  <Cell className={row.clinic ? undefined : "text-text-subtle"}>
                    {row.clinic ?? "—"}
                  </Cell>
                  <Cell className={row.phone ? undefined : "text-text-subtle"}>
                    {row.phone ?? "—"}
                  </Cell>
                  <Cell>
                    <StatusBadge tone={row.status === "active" ? "green" : "neutral"}>
                      {MEDICO_STATUS_LABELS[row.status]}
                    </StatusBadge>
                  </Cell>
                  <Cell align="right">
                    <span className="flex items-center justify-end gap-1">
                      <a
                        href={`/medicos/${row.id}/edit`}
                        aria-label="Ver/editar médico"
                        title="Ver/editar"
                        className="text-primary flex h-8 w-8 items-center justify-center rounded-[9px] transition-colors hover:bg-white/50"
                      >
                        <ViewIcon />
                      </a>
                      <DeleteMedico id={row.id} />
                    </span>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/medicos"
              page={page}
              pageSize={pageSize}
              total={result.data.total}
              params={{ search: sp.search, clinic: sp.clinic }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
