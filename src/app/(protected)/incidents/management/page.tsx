import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { accidentTypeLabel } from "@/shared/domains/safety/accident";
import {
  INCIDENT_STATUS_LABELS,
  incidentStatusLabel,
  incidentStatusSchema,
  type IncidentStatus,
} from "@/shared/domains/safety/incident-lifecycle";
import { resolvePageParams } from "@/shared/pagination";
import { listIncidentsManagementAction } from "@/shared/server/actions/safety/accidents";

import {
  EmptyState,
  ListCard,
  ListToolbar,
  PageHeader,
  Pagination,
  StatusPill,
  Table,
  ToolbarPrimaryLink,
  ToolbarSearch,
  type StatusTone,
} from "../../_ui/list";
import { RowActions, ViewRowAction } from "../../_ui/row-actions";
import { ToolbarSelect } from "../../_ui/toolbar-select";
import { IncidentStatusActions } from "../_components/incident-status-actions";

export const dynamic = "force-dynamic";

const BASE = "/incidents/management";

type SearchParams = Promise<{ page?: string; search?: string; status?: string }>;

const STATUS_TONES: Record<IncidentStatus, StatusTone> = {
  registered: "neutral",
  awaiting_planning: "primary",
  awaiting_completion: "amber",
  completed: "green",
  cancelled: "danger",
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  ...Object.entries(INCIDENT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

function ShieldAlertIcon() {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" />
      <path d="M12 9v4M12 16h.01" />
    </svg>
  );
}

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
  const parsedStatus = incidentStatusSchema.safeParse(sp.status);
  const status = parsedStatus.success ? parsedStatus.data : undefined;

  const result = await listIncidentsManagementAction({ page, q: sp.search, status });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-[22px] px-6 pt-8 pb-10 sm:px-[30px]">
      <PageHeader
        icon={<ShieldAlertIcon />}
        title="Gestão de incidentes"
        description="Tratativa, investigação e ações corretivas de incidentes."
      />

      {result.ok ? null : (
        <p
          role="alert"
          className="glass-card text-danger rounded-[20px] px-5 py-4 text-sm font-semibold"
        >
          Não foi possível carregar os incidentes: {result.error.message}
        </p>
      )}

      <ListCard>
        <ListToolbar action={BASE}>
          <ToolbarSearch
            label="Buscar incidentes"
            placeholder="Buscar por nº CAT, local ou área…"
            defaultValue={sp.search}
          />
          <ToolbarSelect
            name="status"
            label="Filtrar por status"
            value={status}
            options={STATUS_OPTIONS}
          />
          <ToolbarPrimaryLink href="/incidents/new">Novo registro</ToolbarPrimaryLink>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-4 sm:p-6">
            <EmptyState
              title="Nenhum incidente neste estágio"
              message="Ajuste a busca ou o filtro de status, ou registre um novo incidente para acompanhar a tratativa."
            />
          </div>
        ) : (
          <>
            <Table
              embedded
              headers={[
                "Nº CAT",
                "Data",
                "Tipo",
                "Local",
                "Planos ativos",
                "Status",
                "Opções",
              ]}
            >
              {rows.map((row) => (
                <tr key={row.id}>
                  <td
                    className={`px-4 py-3.5 font-mono font-semibold sm:px-6 ${
                      row.catNumber ? "text-primary" : "text-text-subtle"
                    }`}
                  >
                    {row.catNumber ?? "—"}
                  </td>
                  <td className="text-text-muted px-4 py-3.5 font-semibold tabular-nums sm:px-6">
                    <Link href={`/incidents/${row.id}`} className="hover:underline">
                      {new Date(row.occurredAt).toLocaleDateString("pt-BR")}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 font-semibold sm:px-6">
                    {accidentTypeLabel(row.type)}
                  </td>
                  <td className="px-4 py-3.5 sm:px-6">{row.location ?? "—"}</td>
                  <td className="px-4 py-3.5 tabular-nums sm:px-6">
                    {row.activePlanCount > 0 ? (
                      <StatusPill tone="amber">
                        {row.activePlanCount} pendente(s)
                      </StatusPill>
                    ) : (
                      <span className="text-text-subtle">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 sm:px-6">
                    <StatusPill tone={STATUS_TONES[row.status as IncidentStatus]}>
                      {incidentStatusLabel(row.status)}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3.5 sm:px-6">
                    <RowActions>
                      <ViewRowAction href={`/incidents/${row.id}`} label="Abrir" />
                      <IncidentStatusActions
                        id={row.id}
                        current={row.status as IncidentStatus}
                        variant="icons"
                      />
                    </RowActions>
                  </td>
                </tr>
              ))}
            </Table>

            <Pagination
              basePath={BASE}
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ search: sp.search, status }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
