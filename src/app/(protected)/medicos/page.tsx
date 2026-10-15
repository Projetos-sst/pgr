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
  ViewIcon,
} from "../_ui/data-list";
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
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const clinics = clinicsResult.ok ? clinicsResult.data : [];

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<MedicoIcon />}
        title="Médicos"
        description="Médicos do trabalho responsáveis por exames e ASOs"
      />

      <ListCard>
        <ListToolbar>
          <MedicoFilters
            basePath="/medicos"
            search={sp.search}
            clinic={sp.clinic}
            clinics={clinics}
          />
          <ToolbarButton href="/medicos/new">Novo Médico</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
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
              {rows.map((row, i) => (
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
              total={total}
              params={{ search: sp.search, clinic: sp.clinic }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
