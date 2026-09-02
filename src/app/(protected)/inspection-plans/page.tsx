import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import type { PlanStatus } from "@/shared/domains/inspections/plans";
import {
  listPlanCategoriesAction,
  listPlansAction,
} from "@/shared/server/actions/inspections/plans";

import { EmptyState, PageHeader } from "../_ui/list";
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
  type StatusTone,
} from "../_ui/data-list";
import { DeletePlan } from "./_components/delete-plan";
import { InspectionPlanIcon } from "./_components/inspection-plan-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "0.9fr 1.8fr 1.2fr 0.8fr 1.1fr 1fr 84px";

// Status do plano → tom: Ativo verde, Rascunho âmbar, Inativo neutro.
const STATUS_TONE: Record<PlanStatus, StatusTone> = {
  active: "green",
  draft: "amber",
  inactive: "neutral",
};

type SearchParams = Promise<{ search?: string; category?: string; page?: string }>;

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
  const [result, categoriesResult] = await Promise.all([
    listPlansAction({ search: sp.search, category: sp.category, page }),
    listPlanCategoriesAction(),
  ]);
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const categories = categoriesResult.ok
    ? categoriesResult.data.map((c) => ({ value: c, label: c }))
    : [];
  const params = { search: sp.search, category: sp.category };

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
            hidden={{ category: sp.category }}
          />
          <ToolbarSelect
            basePath="/inspection-plans"
            name="category"
            defaultValue={sp.category}
            options={categories}
            emptyLabel="Todas as Categorias"
            hidden={{ search: sp.search }}
          />
          <ToolbarButton href="/inspection-plans/new">Novo Plano</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message={
                sp.search || sp.category
                  ? "Nenhum plano encontrado para o filtro."
                  : "Nenhum plano de inspeção."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={940}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Código" },
                  { header: "Plano" },
                  { header: "Categoria" },
                  { header: "Itens" },
                  { header: "Frequência" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <MonoCell href={`/inspection-plans/${row.id}/edit`}>
                    {row.code}
                  </MonoCell>
                  <Cell className="text-text font-semibold">{row.title}</Cell>
                  <Cell>{row.subtype ?? "—"}</Cell>
                  <Cell className="text-text-muted font-mono">{row.itemCount} itens</Cell>
                  <Cell>{row.frequencyLabel}</Cell>
                  <Cell>
                    <StatusBadge
                      tone={STATUS_TONE[row.status as PlanStatus] ?? "neutral"}
                    >
                      {row.statusLabel}
                    </StatusBadge>
                  </Cell>
                  <Cell align="right">
                    <RowActions>
                      <EditIconLink href={`/inspection-plans/${row.id}/edit`} />
                      <DeletePlan id={row.id} />
                    </RowActions>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/inspection-plans"
              page={page}
              pageSize={pageSize}
              total={total}
              params={params}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
