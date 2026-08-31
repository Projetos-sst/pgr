import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listWorkUnitsAction } from "@/shared/server/actions/pgr/work-units";

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
  const result = await listWorkUnitsAction({
    search: sp.search,
    companyId: sp.companyId,
    page,
  });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

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
          <ToolbarButton href="/work-units/new">Nova Unidade</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message={
                sp.search
                  ? "Nenhuma unidade de obra encontrada para a busca."
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
                  <Cell className="text-text-subtle">—</Cell>
                  <Cell>{[row.city, row.state].filter(Boolean).join(" / ") || "—"}</Cell>
                  <Cell className={row.managerName ? undefined : "text-text-subtle"}>
                    {row.managerName ?? "—"}
                  </Cell>
                  <Cell>
                    <StatusBadge tone="green">Ativa</StatusBadge>
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
