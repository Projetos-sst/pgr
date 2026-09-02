import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  ACCIDENT_SEVERITY_LABELS,
  accidentFiltersSchema,
} from "@/shared/domains/safety/accident";
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
  ToolbarSelect,
  type StatusTone,
} from "../_ui/data-list";
import { EmptyState, PageHeader } from "../_ui/list";
import { DeleteIncident } from "./_components/delete-incident";
import { IncidentIcon } from "./_components/incident-icon";

export const dynamic = "force-dynamic";

// Nº · Data · Tipo · Gravidade · Status · Opções (mockup; Funcionário omitido por
// privacidade — incidente é dado de saúde P0/P3; Empresa fica no detalhe).
const TEMPLATE = "0.9fr 1fr 1.8fr 1.1fr 1.2fr 84px";

const SEVERITY_TONE: Record<string, StatusTone> = {
  no_injury: "green",
  minor: "amber",
  moderate: "amber",
  severe: "red",
  fatal: "red",
};

const STATUS_TONE: Record<string, StatusTone> = {
  registered: "indigo",
  awaiting_planning: "indigo",
  awaiting_completion: "indigo",
  completed: "green",
  cancelled: "neutral",
};

const SEVERITY_OPTIONS = Object.entries(ACCIDENT_SEVERITY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

type SearchParams = Promise<{ page?: string; search?: string; severity?: string }>;

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
  const parsedSeverity = accidentFiltersSchema.shape.severity.safeParse(sp.severity);
  const severity = parsedSeverity.success ? parsedSeverity.data : undefined;

  const result = await listAccidentsAction({ page, q: sp.search, severity });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const params = { search: sp.search, severity: sp.severity };

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<IncidentIcon />}
        title="Incidentes"
        description="Registro de incidentes, acidentes e quase-acidentes"
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/incidents"
            placeholder="Buscar por nº, local ou nº CAT…"
            defaultValue={sp.search}
            hidden={{ severity: sp.severity }}
          />
          <ToolbarSelect
            basePath="/incidents"
            name="severity"
            defaultValue={sp.severity}
            options={SEVERITY_OPTIONS}
            emptyLabel="Todas as Gravidades"
            hidden={{ search: sp.search }}
          />
          <ToolbarButton href="/incidents/new">Novo Registro</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Nenhum incidente/acidente encontrado." />
          </div>
        ) : (
          <>
            <DataGrid minWidth={880}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Nº" },
                  { header: "Data" },
                  { header: "Tipo" },
                  { header: "Gravidade" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <MonoCell href={`/incidents/${row.id}`}>{row.numberLabel}</MonoCell>
                  <Cell className="text-text-muted">{formatDate(row.occurredAt)}</Cell>
                  <Cell className="text-text font-semibold">{row.typeLabel}</Cell>
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
