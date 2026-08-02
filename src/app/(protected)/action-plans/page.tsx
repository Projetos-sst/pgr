import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  actionPlanFiltersSchema,
  type ActionPlanStatus,
} from "@/shared/domains/safety/action-plan";
import { resolvePageParams } from "@/shared/pagination";
import {
  getActionPlanSummaryAction,
  listActionPlansAction,
} from "@/shared/server/actions/safety/action-plans";

import { EmptyState, PageHeader } from "../_ui/list";
import {
  Cell,
  DataGrid,
  GridHeader,
  GridRow,
  ListCard,
  ListFooter,
  ListToolbar,
  StatusBadge,
  ToolbarButton,
  ViewIcon,
  type StatusTone,
} from "../_ui/data-list";
import { ActionPlanFilters } from "./_components/action-plan-filters";
import { ActionPlanIcon } from "./_components/action-plan-icon";
import { ActionPlanStats } from "./_components/action-plan-stats";
import { DeleteActionPlan } from "./_components/delete-action-plan";

export const dynamic = "force-dynamic";

const TEMPLATE = "2.4fr 1.7fr 1fr 1.1fr 1fr 84px";

const STATUS_TONE: Record<ActionPlanStatus, StatusTone> = {
  planned: "indigo",
  in_progress: "amber",
  completed: "green",
  cancelled: "neutral",
};

type SearchParams = Promise<{ page?: string; search?: string; status?: string }>;

export default async function ActionPlansPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const parsedStatus = actionPlanFiltersSchema.shape.status.safeParse(sp.status);
  const status = parsedStatus.success ? parsedStatus.data : undefined;

  const [listResult, summaryResult] = await Promise.all([
    listActionPlansAction({ page, q: sp.search, status }),
    getActionPlanSummaryAction(),
  ]);
  const { rows, total } = listResult.ok ? listResult.data : { rows: [], total: 0 };
  const summary = summaryResult.ok
    ? summaryResult.data
    : { planned: 0, inProgress: 0, completed: 0, overdue: 0 };

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<ActionPlanIcon />}
        title="Gestão de Planos de Ação"
        description="Acompanhe o progresso e gerencie os planos de ação (5W2H) por origem."
      />

      <ActionPlanStats summary={summary} />

      <ListCard>
        <ListToolbar>
          <ActionPlanFilters
            basePath="/action-plans"
            search={sp.search}
            status={sp.status}
          />
          <ToolbarButton href="/action-plans/new">Novo Plano</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              isFlat
              message={
                sp.search || status
                  ? "Nenhum plano de ação encontrado para os filtros."
                  : "Nenhum plano de ação cadastrado."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={940}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "O quê" },
                  { header: "Origem" },
                  { header: "Prioridade" },
                  { header: "Prazo" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <Cell className="text-text font-semibold">
                    <a href={`/action-plans/${row.id}`} className="hover:underline">
                      {row.what.length > 64 ? `${row.what.slice(0, 64)}…` : row.what}
                    </a>
                  </Cell>
                  <Cell>
                    {row.origin.removed ? (
                      <span className="text-text-subtle italic">Origem removida</span>
                    ) : (
                      <span className="inline-flex flex-col">
                        <span className="text-text-subtle font-mono text-[10px] tracking-wider uppercase">
                          {row.origin.type === "risk" ? "Risco" : "Incidente"}
                        </span>
                        <span className="text-text-muted">{row.origin.title}</span>
                      </span>
                    )}
                  </Cell>
                  <Cell>{row.priorityLabel}</Cell>
                  <Cell className="tabular-nums">
                    <span className="inline-flex items-center gap-2">
                      {row.when ?? "—"}
                      {row.overdue ? (
                        <StatusBadge tone="red">Atrasado</StatusBadge>
                      ) : null}
                    </span>
                  </Cell>
                  <Cell>
                    <StatusBadge tone={STATUS_TONE[row.status as ActionPlanStatus]}>
                      {row.statusLabel}
                    </StatusBadge>
                  </Cell>
                  <Cell align="right">
                    <span className="flex items-center justify-end gap-1">
                      <a
                        href={`/action-plans/${row.id}`}
                        aria-label="Abrir plano"
                        title="Abrir"
                        className="text-primary flex h-8 w-8 items-center justify-center rounded-[9px] transition-colors hover:bg-white/50"
                      >
                        <ViewIcon />
                      </a>
                      <DeleteActionPlan id={row.id} />
                    </span>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/action-plans"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ search: sp.search, status: sp.status }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
