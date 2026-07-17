import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  ACTION_PLAN_STATUS_LABELS,
  actionPlanFiltersSchema,
} from "@/shared/domains/safety/action-plan";
import { resolvePageParams } from "@/shared/pagination";
import { listActionPlansAction } from "@/shared/server/actions/safety/action-plans";

import {
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  SearchForm,
  Table,
} from "../_ui/list";
import { DeleteActionPlan } from "./_components/delete-action-plan";

export const dynamic = "force-dynamic";

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

  const result = await listActionPlansAction({ page, q: sp.search, status });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const params = { search: sp.search, status: sp.status };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Planos de Ação"
        description="Central multiorigem de planos 5W2H a partir de riscos e incidentes."
        action={<PrimaryLink href="/action-plans/new">Novo plano</PrimaryLink>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchForm
          basePath="/action-plans"
          placeholder="Buscar por 'o quê' ou responsável"
          defaultValue={sp.search}
          hidden={{ status: sp.status }}
        />
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/action-plans"
            className={`glass-panel rounded-card px-3 py-1 font-semibold transition-colors ${
              !sp.status ? "text-primary-strong" : "text-text-muted hover:text-text"
            }`}
          >
            Todos
          </Link>
          {Object.entries(ACTION_PLAN_STATUS_LABELS).map(([value, label]) => (
            <Link
              key={value}
              href={`/action-plans?status=${value}`}
              className={`glass-panel rounded-card px-3 py-1 font-semibold transition-colors ${
                sp.status === value
                  ? "text-primary-strong"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="Nenhum plano de ação encontrado." />
      ) : (
        <Table headers={["O quê", "Origem", "Prioridade", "Prazo", "Status", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2">
                <Link
                  href={`/action-plans/${row.id}`}
                  className="font-medium hover:underline"
                >
                  {row.what.length > 60 ? `${row.what.slice(0, 60)}…` : row.what}
                </Link>
              </td>
              <td className="px-4 py-2">
                {row.origin.removed ? (
                  <span className="text-text-subtle italic">Origem removida</span>
                ) : (
                  <span>
                    <span className="text-text-subtle font-mono text-[10px] uppercase">
                      {row.origin.type === "risk" ? "Risco" : "Incidente"}
                    </span>{" "}
                    {row.origin.title}
                  </span>
                )}
              </td>
              <td className="px-4 py-2">{row.priorityLabel}</td>
              <td className="px-4 py-2 tabular-nums">
                {row.when ?? "—"}
                {row.overdue ? (
                  <span className="rounded-pill ml-2 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                    Atrasado
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-2">{row.statusLabel}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/action-plans/${row.id}`}
                    className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
                  >
                    Abrir
                  </Link>
                  <DeleteActionPlan id={row.id} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/action-plans"
        page={page}
        pageSize={pageSize}
        total={total}
        params={params}
      />
    </div>
  );
}
