import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { accidentFiltersSchema } from "@/shared/domains/safety/accident";
import { INCIDENT_STATUS_LABELS } from "@/shared/domains/safety/incident-lifecycle";
import { resolvePageParams } from "@/shared/pagination";
import { listAccidentsAction } from "@/shared/server/actions/safety/accidents";

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
  type StatusTone,
} from "../_ui/data-list";
import { EmptyState, PageHeader } from "../_ui/list";
import { DeleteIncident } from "./_components/delete-incident";
import { IncidentIcon } from "./_components/incident-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "1fr 1.8fr 1.2fr 1fr 1.2fr 1.1fr 84px";

const SEVERITY_TONE: Record<string, StatusTone> = {
  minor: "green",
  moderate: "amber",
  severe: "red",
  fatal: "red",
};

const STATUS_TONE: Record<string, StatusTone> = {
  registered: "amber",
  awaiting_planning: "indigo",
  awaiting_completion: "indigo",
  completed: "green",
  cancelled: "neutral",
};

type SearchParams = Promise<{ page?: string; search?: string; status?: string }>;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const parsedStatus = accidentFiltersSchema.shape.status.safeParse(sp.status);
  const status = parsedStatus.success ? parsedStatus.data : undefined;

  const result = await listAccidentsAction({ page, q: sp.search, status });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const params = { search: sp.search, status: sp.status };

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<IncidentIcon />}
        title="Incidentes / Acidentes"
        description="Registro interno de incidentes e acidentes de trabalho"
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/incidents"
            placeholder="Buscar por local, área ou nº CAT…"
            defaultValue={sp.search}
            hidden={{ status: sp.status }}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href="/incidents"
              className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                !sp.status
                  ? "btn-primary"
                  : "text-text-muted hover:text-text border border-white/70 bg-white/50"
              }`}
            >
              Todos
            </Link>
            {Object.entries(INCIDENT_STATUS_LABELS).map(([value, label]) => (
              <Link
                key={value}
                href={`/incidents?status=${value}`}
                className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  sp.status === value
                    ? "btn-primary"
                    : "text-text-muted hover:text-text border border-white/70 bg-white/50"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          <ToolbarButton href="/incidents/new">Novo Registro</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Nenhum incidente/acidente encontrado." />
          </div>
        ) : (
          <>
            <DataGrid minWidth={960}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Data" },
                  { header: "Empresa" },
                  { header: "Tipo" },
                  { header: "Categoria" },
                  { header: "Gravidade" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <MonoCell href={`/incidents/${row.id}`}>
                    {formatDate(row.occurredAt)}
                  </MonoCell>
                  <Cell className="text-text font-semibold">
                    {row.companyName ?? "—"}
                  </Cell>
                  <Cell>{row.typeLabel}</Cell>
                  <Cell>{row.categoryLabel}</Cell>
                  <Cell>
                    <StatusBadge tone={SEVERITY_TONE[row.severity] ?? "neutral"}>
                      {row.severityLabel}
                    </StatusBadge>
                  </Cell>
                  <Cell>
                    <StatusBadge tone={STATUS_TONE[row.status] ?? "neutral"}>
                      {row.statusLabel}
                    </StatusBadge>
                  </Cell>
                  <Cell align="right">
                    <RowActions>
                      <EditIconLink href={`/incidents/${row.id}`} />
                      <DeleteIncident id={row.id} />
                    </RowActions>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/incidents"
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
