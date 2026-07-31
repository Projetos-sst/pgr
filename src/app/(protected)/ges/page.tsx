import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listGesAction } from "@/shared/server/actions/pgr/ges";

import {
  AvatarBadge,
  Cell,
  DataGrid,
  EditIconLink,
  GridHeader,
  GridRow,
  ListCard,
  ListFooter,
  ListToolbar,
  RowActions,
  ToolbarButton,
  ToolbarSearch,
} from "../_ui/data-list";
import { EmptyState, PageHeader } from "../_ui/list";
import { DeleteGes } from "./_components/delete-ges";
import { GesIcon } from "./_components/ges-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "1.8fr 2.4fr 0.9fr 84px";

type SearchParams = Promise<{
  search?: string;
  page?: string;
  companyId?: string;
  workUnitId?: string;
}>;

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
  const { rows, total, totalWorkers } = result.ok
    ? result.data
    : { rows: [], total: 0, totalWorkers: 0 };

  const filters = { companyId: sp.companyId, workUnitId: sp.workUnitId };

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<GesIcon />}
        title="GES"
        description={`Grupos de Exposição Similar · ${totalWorkers} trabalhador(es) exposto(s)`}
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/ges"
            placeholder="Buscar por nome ou descrição…"
            defaultValue={sp.search}
            hidden={filters}
          />
          <ToolbarButton href="/ges/new">Novo GES</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message={
                sp.search
                  ? "Nenhum GES encontrado para a busca."
                  : "Nenhum GES cadastrado."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={760}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Setor / GES" },
                  { header: "Descrição do processo" },
                  { header: "Expostos" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <Cell>
                    <span className="flex items-center gap-3">
                      <AvatarBadge name={row.name} />
                      <span className="text-text font-semibold">{row.name}</span>
                    </span>
                  </Cell>
                  <Cell className="text-text-muted">
                    {row.processDescription ?? "—"}
                  </Cell>
                  <Cell className="text-text-subtle">{row.exposedWorkers}</Cell>
                  <Cell align="right">
                    <RowActions>
                      <EditIconLink href={`/ges/${row.id}/edit`} />
                      <DeleteGes id={row.id} />
                    </RowActions>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/ges"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ search: sp.search, ...filters }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
