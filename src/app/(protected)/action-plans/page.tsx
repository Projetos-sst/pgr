import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  ACTION_PLAN_TYPE_LABELS,
  actionPlanFiltersSchema,
} from "@/shared/domains/safety/action-plan";
import { resolvePageParams } from "@/shared/pagination";
import {
  listActionPlanKpisAction,
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
  RowActions,
  StatusBadge,
  ToolbarSearch,
  ToolbarSelect,
  ViewIcon,
  type StatusTone,
} from "../_ui/data-list";
import { ActionPlanIcon } from "./_components/action-plan-icon";
import { DeleteActionPlan } from "./_components/delete-action-plan";

export const dynamic = "force-dynamic";

const TEMPLATE = "1.3fr 1fr 1.3fr 1.8fr 1fr 1.1fr 84px";

const STATUS_TONE: Record<string, StatusTone> = {
  planned: "indigo",
  in_progress: "amber",
  completed: "green",
  cancelled: "neutral",
};

const TYPE_OPTIONS = Object.entries(ACTION_PLAN_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function KpiTile({
  label,
  value,
  tone,
  filled,
}: {
  label: string;
  value: number;
  tone: "indigo" | "amber" | "green";
  filled?: boolean;
}) {
  const toneColor =
    tone === "green" ? "#0e9f6e" : tone === "amber" ? "#c9820a" : "var(--color-primary)";
  return (
    <div
      className={`rounded-card border p-4 shadow-sm ${
        filled ? "text-white" : "glass-panel border-white/60"
      }`}
      style={
        filled
          ? { background: "var(--color-primary)", borderColor: "transparent" }
          : undefined
      }
    >
      <div
        className="font-mono text-[28px] leading-none font-extrabold"
        style={filled ? undefined : { color: toneColor }}
      >
        {value}
      </div>
      <div
        className={`mt-2 text-[11px] font-semibold tracking-wide uppercase ${
          filled ? "text-white/80" : "text-text-muted"
        }`}
      >
        {label}
      </div>
    </div>
  );
}

type SearchParams = Promise<{
  page?: string;
  search?: string;
  status?: string;
  type?: string;
}>;

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
  const statusParsed = actionPlanFiltersSchema.shape.status.safeParse(sp.status);
  const typeParsed = actionPlanFiltersSchema.shape.type.safeParse(sp.type);

  const [result, kpisResult] = await Promise.all([
    listActionPlansAction({
      page,
      q: sp.search,
      status: statusParsed.success ? statusParsed.data : undefined,
      type: typeParsed.success ? typeParsed.data : undefined,
    }),
    listActionPlanKpisAction(),
  ]);
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const kpis = kpisResult.ok
    ? kpisResult.data
    : { planned: 0, inProgress: 0, completed: 0, cancelled: 0, dueSoon: 0, total: 0 };
  const params = { search: sp.search, status: sp.status, type: sp.type };

  const statusPills = [
    { key: undefined as string | undefined, label: "Todos", count: kpis.total },
    { key: "planned", label: "Planejado", count: kpis.planned },
    { key: "in_progress", label: "Em andamento", count: kpis.inProgress },
    { key: "completed", label: "Concluído", count: kpis.completed },
    { key: "cancelled", label: "Cancelado", count: kpis.cancelled },
  ];
  const pillHref = (key: string | undefined) => {
    const qs = new URLSearchParams();
    if (key) qs.set("status", key);
    if (sp.search) qs.set("search", sp.search);
    if (sp.type) qs.set("type", sp.type);
    const s = qs.toString();
    return `/action-plans${s ? `?${s}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<ActionPlanIcon />}
        title="Gestão de Planos de Ação"
        description="Acompanhe o progresso e gerencie os planos de ação cadastrados."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile label="Planejados" value={kpis.planned} tone="indigo" />
        <KpiTile label="Em andamento" value={kpis.inProgress} tone="amber" />
        <KpiTile label="Concluídos" value={kpis.completed} tone="green" />
        <KpiTile label="Próx. vencer (30d)" value={kpis.dueSoon} tone="indigo" filled />
      </div>

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/action-plans"
            placeholder="Buscar por ação, responsável, descrição…"
            defaultValue={sp.search}
            hidden={{ status: sp.status, type: sp.type }}
          />
          <ToolbarSelect
            basePath="/action-plans"
            name="type"
            defaultValue={sp.type}
            options={TYPE_OPTIONS}
            emptyLabel="Todos os Tipos"
            hidden={{ status: sp.status, search: sp.search }}
          />
        </ListToolbar>

        <div className="flex flex-wrap gap-1.5 px-5 pb-3">
          {statusPills.map((p) => {
            const active = sp.status === p.key || (!sp.status && !p.key);
            return (
              <Link
                key={p.label}
                href={pillHref(p.key)}
                className={`rounded-xl px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  active
                    ? "btn-primary"
                    : "text-text-muted hover:text-text border border-white/70 bg-white/50"
                }`}
              >
                {p.label}{" "}
                <span className="font-mono text-xs opacity-80">({p.count})</span>
              </Link>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Nenhum plano de ação encontrado." />
          </div>
        ) : (
          <>
            <DataGrid minWidth={1000}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Empresa" },
                  { header: "Tipo" },
                  { header: "Localização" },
                  { header: "Ação / Responsável" },
                  { header: "Prazo" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <Cell className="text-text font-semibold">
                    {row.companyName ?? "—"}
                  </Cell>
                  <Cell>{row.typeLabel}</Cell>
                  <Cell className="text-text-muted">{row.where}</Cell>
                  <Cell>
                    <Link href={`/action-plans/${row.id}`} className="block">
                      <span className="text-text font-semibold">
                        {row.what.length > 48 ? `${row.what.slice(0, 48)}…` : row.what}
                      </span>
                      <span className="text-text-subtle block text-xs">{row.who}</span>
                    </Link>
                  </Cell>
                  <Cell
                    className={`font-mono ${row.overdue ? "text-danger font-semibold" : "text-text-muted"}`}
                  >
                    {row.when ?? "—"}
                  </Cell>
                  <Cell>
                    <StatusBadge tone={STATUS_TONE[row.status] ?? "neutral"}>
                      {row.statusLabel}
                    </StatusBadge>
                  </Cell>
                  <Cell align="right">
                    <RowActions>
                      <span className="contents">
                        <Link
                          href={`/action-plans/${row.id}`}
                          aria-label="Abrir plano"
                          title="Abrir"
                          className="text-primary flex h-8 w-8 items-center justify-center rounded-[9px] transition-colors hover:bg-white/50"
                        >
                          <ViewIcon />
                        </Link>
                      </span>
                      <DeleteActionPlan id={row.id} />
                    </RowActions>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/action-plans"
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
