import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listJobRolesAction } from "@/shared/server/actions/pgr/job-roles";
import { listGesOptionsAction } from "@/shared/server/actions/pgr/ges";

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
import { DeleteJobRole } from "./_components/delete-job-role";
import { JobRoleIcon } from "./_components/job-role-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "1fr 1.8fr 1.2fr 1fr 1.2fr 1.1fr 84px";

type SearchParams = Promise<{
  search?: string;
  page?: string;
  companyId?: string;
  gesId?: string;
}>;

export default async function JobRolesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const [result, gesOptions] = await Promise.all([
    listJobRolesAction({
      search: sp.search,
      companyId: sp.companyId,
      gesId: sp.gesId,
      page,
    }),
    listGesOptionsAction(),
  ]);
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const gesList = gesOptions.ok ? gesOptions.data : [];

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<JobRoleIcon />}
        title="Funções (Cargos)"
        description="Cargos ocupacionais por empresa, com CBO"
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/job-roles"
            placeholder="Buscar por título ou CBO…"
            defaultValue={sp.search}
            hidden={{ companyId: sp.companyId, gesId: sp.gesId }}
          />
          <ToolbarSelect
            basePath="/job-roles"
            name="gesId"
            defaultValue={sp.gesId}
            options={gesList.map((g) => ({ value: g.id, label: g.name }))}
            emptyLabel="Todos os GES"
            hidden={{ search: sp.search, companyId: sp.companyId }}
          />
          <ToolbarButton href="/job-roles/new">Nova Função</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message={
                sp.search || sp.gesId
                  ? "Nenhuma função encontrada para os filtros."
                  : "Nenhuma função cadastrada."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={920}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "CBO" },
                  { header: "Função" },
                  { header: "GES" },
                  { header: "Setor" },
                  { header: "Funcionários" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <MonoCell href={`/job-roles/${row.id}/edit`}>{row.cbo ?? "—"}</MonoCell>
                  <Cell className="text-text font-semibold">{row.title}</Cell>
                  <Cell className={row.gesNames ? undefined : "text-text-subtle"}>
                    {row.gesNames ?? "—"}
                  </Cell>
                  <Cell className={row.sector ? undefined : "text-text-subtle"}>
                    {row.sector ?? "—"}
                  </Cell>
                  <Cell className={row.employeeCount ? undefined : "text-text-subtle"}>
                    {row.employeeCount}
                  </Cell>
                  <Cell>
                    <StatusBadge tone={row.isActive ? "green" : "neutral"}>
                      {row.isActive ? "Ativa" : "Inativa"}
                    </StatusBadge>
                  </Cell>
                  <Cell align="right">
                    <RowActions>
                      <EditIconLink href={`/job-roles/${row.id}/edit`} />
                      <DeleteJobRole id={row.id} />
                    </RowActions>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/job-roles"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ search: sp.search, companyId: sp.companyId, gesId: sp.gesId }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
