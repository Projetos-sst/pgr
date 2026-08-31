import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import {
  WORK_UNIT_STATUS_LABELS,
  WORK_UNIT_STATUS_TONE,
} from "@/shared/domains/pgr/work-units";
import { listWorkUnitsAction } from "@/shared/server/actions/pgr/work-units";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import {
  Cell,
  DataGrid,
  EditIconLink,
  GridHeader,
  GridRow,
  ListCard,
  ListFooter,
  ListToolbar,
  MonoCell,
  RowActions,
  StatusBadge,
  ToolbarButton,
  ToolbarSearch,
  ToolbarSelect,
} from "../_ui/data-list";
import { EmptyState, PageHeader } from "../_ui/list";
import { DeleteWorkUnit } from "./_components/delete-work-unit";
import { WorkUnitIcon } from "./_components/work-unit-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "1fr 1.8fr 1.2fr 1fr 1.2fr 1.1fr 84px";

type SearchParams = Promise<{ search?: string; page?: string; companyId?: string }>;

export default async function WorkUnitsPage({
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
    listWorkUnitsAction({ search: sp.search, companyId: sp.companyId, page }),
    listCompanyOptionsAction(),
  ]);
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const companies = companyOptions.ok ? companyOptions.data : [];

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<WorkUnitIcon />}
        title="Unidades de obra"
        description="Canteiros, filiais e locais por empresa"
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/work-units"
            placeholder="Buscar por nome, contrato ou objeto…"
            defaultValue={sp.search}
            hidden={{ companyId: sp.companyId }}
          />
          <ToolbarSelect
            basePath="/work-units"
            name="companyId"
            defaultValue={sp.companyId}
            options={companies.map((c) => ({ value: c.id, label: c.razaoSocial }))}
            emptyLabel="Todas as Empresas"
            hidden={{ search: sp.search }}
          />
          <ToolbarButton href="/work-units/new">Nova Unidade</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message={
                sp.search || sp.companyId
                  ? "Nenhuma unidade de obra encontrada para os filtros."
                  : "Nenhuma unidade de obra cadastrada."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={920}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Código" },
                  { header: "Unidade / Obra" },
                  { header: "Empresa" },
                  { header: "Cidade / UF" },
                  { header: "Responsável" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <MonoCell href={`/work-units/${row.id}/edit`}>
                    {row.contractNumber ?? "—"}
                  </MonoCell>
                  <Cell className="text-text font-semibold">{row.name}</Cell>
                  <Cell>{row.companyName}</Cell>
                  <Cell>{[row.city, row.state].filter(Boolean).join(" / ") || "—"}</Cell>
                  <Cell className={row.managerName ? undefined : "text-text-subtle"}>
                    {row.managerName ?? "—"}
                  </Cell>
                  <Cell>
                    <StatusBadge tone={WORK_UNIT_STATUS_TONE[row.status]}>
                      {WORK_UNIT_STATUS_LABELS[row.status]}
                    </StatusBadge>
                  </Cell>
                  <Cell align="right">
                    <RowActions>
                      <EditIconLink href={`/work-units/${row.id}/edit`} />
                      <DeleteWorkUnit id={row.id} />
                    </RowActions>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/work-units"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ search: sp.search, companyId: sp.companyId }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
