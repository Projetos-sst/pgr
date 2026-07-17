import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { accidentTypeLabel } from "@/shared/domains/safety/accident";
import {
  incidentStatusLabel,
  type IncidentStatus,
} from "@/shared/domains/safety/incident-lifecycle";
import { resolvePageParams } from "@/shared/pagination";
import { listIncidentsManagementAction } from "@/shared/server/actions/safety/accidents";

import { EmptyState, PageHeader, Pagination, Table } from "../../_ui/list";
import { IncidentStatusActions } from "../_components/incident-status-actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string; stage?: string; hideDone?: string }>;

// Filtros da tela central de gestão (FR-030).
const STAGES: { value: string; label: string; status?: IncidentStatus }[] = [
  { value: "all", label: "Todos" },
  {
    value: "awaiting_planning",
    label: "Aguardando planejamento",
    status: "awaiting_planning",
  },
  {
    value: "awaiting_completion",
    label: "Aguardando conclusão",
    status: "awaiting_completion",
  },
  { value: "completed", label: "Concluídos", status: "completed" },
];

export default async function IncidentsManagementPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const stage = STAGES.find((s) => s.value === sp.stage) ?? STAGES[0];
  const hideDone = sp.hideDone === "1";

  const result = await listIncidentsManagementAction({ page, status: stage.status });
  let rows = result.ok ? result.data.rows : [];
  const total = result.ok ? result.data.total : 0;
  if (hideDone)
    rows = rows.filter((r) => r.status !== "completed" && r.status !== "cancelled");

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Gestão de incidentes"
        description="Acompanhe o ciclo de vida: planejamento, conclusão e planos de ação por incidente."
      />

      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex flex-wrap gap-2 text-sm">
          {STAGES.map((s) => (
            <Link
              key={s.value}
              href={`/incidents/management?stage=${s.value}${hideDone ? "&hideDone=1" : ""}`}
              className={`glass-panel rounded-card px-3 py-1 font-semibold transition-colors ${
                stage.value === s.value
                  ? "text-primary-strong"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
        <Link
          href={`/incidents/management?stage=${stage.value}${hideDone ? "" : "&hideDone=1"}`}
          className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
        >
          {hideDone ? "Mostrar concluídos" : "Ocultar concluídos"}
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="Nenhum incidente neste estágio." />
      ) : (
        <Table
          headers={["Ocorrência", "Empresa", "Tipo", "Estágio", "Planos ativos", "Ações"]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2 tabular-nums">
                <Link
                  href={`/incidents/${row.id}`}
                  className="font-medium hover:underline"
                >
                  {new Date(row.occurredAt).toLocaleDateString("pt-BR")}
                </Link>
              </td>
              <td className="px-4 py-2">{row.companyName ?? "—"}</td>
              <td className="px-4 py-2">{accidentTypeLabel(row.type)}</td>
              <td className="px-4 py-2">{incidentStatusLabel(row.status)}</td>
              <td className="px-4 py-2 tabular-nums">
                {row.activePlanCount > 0 ? (
                  <span className="rounded-pill bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    {row.activePlanCount} pendente(s)
                  </span>
                ) : (
                  <span className="text-text-subtle">0</span>
                )}
              </td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Link
                    href="/action-plans/new"
                    className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
                  >
                    Iniciar plano
                  </Link>
                  <IncidentStatusActions
                    id={row.id}
                    current={row.status as IncidentStatus}
                  />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/incidents/management"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ stage: stage.value, hideDone: hideDone ? "1" : undefined }}
      />
    </div>
  );
}
