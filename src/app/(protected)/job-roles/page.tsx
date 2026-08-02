import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listJobRolesAction } from "@/shared/server/actions/pgr/job-roles";

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
import { DeleteJobRole } from "./_components/delete-job-role";
import { JobRoleIcon } from "./_components/job-role-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "1fr 1.8fr 1.2fr 1fr 1.2fr 1.1fr 84px";

type SearchParams = Promise<{ search?: string; page?: string; companyId?: string }>;

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
  const result = await listJobRolesAction({
    search: sp.search,
    companyId: sp.companyId,
    page,
  });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

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
            hidden={{ companyId: sp.companyId }}
          />
          <ToolbarButton href="/job-roles/new">Nova Função</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message={
                sp.search
                  ? "Nenhuma função encontrada para a busca."
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
                  <Cell className="text-text-subtle">—</Cell>
                  <Cell className="text-text-subtle">—</Cell>
                  <Cell className="text-text-subtle">—</Cell>
                  <Cell>
                    <StatusBadge tone="green">Ativa</StatusBadge>
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
              params={{ search: sp.search, companyId: sp.companyId }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
