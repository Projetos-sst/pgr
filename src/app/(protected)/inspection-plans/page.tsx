import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listPlansAction } from "@/shared/server/actions/inspections/plans";

import { EmptyState, PageHeader } from "../_ui/list";
import {
  Cell,
  DataGrid,
  GridHeader,
  GridRow,
  ListCard,
  ListFooter,
  ListToolbar,
  ToolbarButton,
  ToolbarSearch,
  ViewIcon,
} from "../_ui/data-list";
import { DeletePlan } from "./_components/delete-plan";
import { InspectionPlanIcon } from "./_components/inspection-plan-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "2.2fr 1.3fr 1fr 84px";

type SearchParams = Promise<{ search?: string; page?: string }>;

export default async function PlanosInspecaoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listPlansAction({ search: sp.search, page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<InspectionPlanIcon />}
        title="Planos de Inspeção"
        description="Modelos de inspeção reutilizáveis por categoria de ativo"
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/inspection-plans"
            placeholder="Buscar por plano…"
            defaultValue={sp.search}
          />
          <ToolbarButton href="/inspection-plans/new">Novo Plano</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              isFlat
              message={
                sp.search
                  ? "Nenhum plano encontrado para a busca."
                  : "Nenhum plano de inspeção cadastrado."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={720}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Plano" },
                  { header: "Tipo" },
                  { header: "Itens" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <Cell className="text-text font-semibold">
                    <a
                      href={`/inspection-plans/${row.id}/edit`}
                      className="hover:underline"
                    >
                      {row.title}
                    </a>
                  </Cell>
                  <Cell>{row.typeLabel}</Cell>
                  <Cell className="tabular-nums">
                    {row.itemCount} {row.itemCount === 1 ? "item" : "itens"}
                  </Cell>
                  <Cell align="right">
                    <span className="flex items-center justify-end gap-1">
                      <a
                        href={`/inspection-plans/${row.id}/edit`}
                        aria-label="Ver/editar plano"
                        title="Ver/editar"
                        className="text-primary flex h-8 w-8 items-center justify-center rounded-[9px] transition-colors hover:bg-white/50"
                      >
                        <ViewIcon />
                      </a>
                      <DeletePlan id={row.id} />
                    </span>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/inspection-plans"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ search: sp.search }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
