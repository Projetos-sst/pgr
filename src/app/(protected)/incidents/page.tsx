import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { accidentFiltersSchema } from "@/shared/domains/safety/accident";
import { INCIDENT_STATUS_LABELS } from "@/shared/domains/safety/incident-lifecycle";
import { resolvePageParams } from "@/shared/pagination";
import { listAccidentsAction } from "@/shared/server/actions/safety/accidents";

import {
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  SearchForm,
  Table,
} from "../_ui/list";
import { RowActions, ViewRowAction } from "../_ui/row-actions";
import { DeleteIncident } from "./_components/delete-incident";

export const dynamic = "force-dynamic";

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
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Incidentes/Acidentes"
        description="Registro interno de incidentes e acidentes de trabalho, restrito à equipe do escritório."
        action={<PrimaryLink href="/incidents/new">Novo registro</PrimaryLink>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchForm
          basePath="/incidents"
          placeholder="Buscar por local, área ou nº CAT"
          defaultValue={sp.search}
          hidden={{ status: sp.status }}
        />
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/incidents"
            className={`glass-panel rounded-card px-3 py-1 font-semibold transition-colors ${
              !sp.status ? "text-primary-strong" : "text-text-muted hover:text-text"
            }`}
          >
            Todos
          </Link>
          {Object.entries(INCIDENT_STATUS_LABELS).map(([value, label]) => (
            <Link
              key={value}
              href={`/incidents?status=${value}`}
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
        <EmptyState message="Nenhum incidente/acidente encontrado." />
      ) : (
        <Table
          headers={[
            "Ocorrência",
            "Empresa",
            "Tipo",
            "Categoria",
            "Severidade",
            "Status",
            "",
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2 tabular-nums">
                <Link
                  href={`/incidents/${row.id}`}
                  className="font-medium hover:underline"
                >
                  {formatDate(row.occurredAt)}
                </Link>
              </td>
              <td className="px-4 py-2">{row.companyName ?? "—"}</td>
              <td className="px-4 py-2">{row.typeLabel}</td>
              <td className="px-4 py-2">{row.categoryLabel}</td>
              <td className="px-4 py-2">{row.severityLabel}</td>
              <td className="px-4 py-2">{row.statusLabel}</td>
              <td className="px-4 py-2">
                <RowActions>
                  <ViewRowAction href={`/incidents/${row.id}`} label="Abrir" />
                  <DeleteIncident id={row.id} />
                </RowActions>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/incidents"
        page={page}
        pageSize={pageSize}
        total={total}
        params={params}
      />
    </div>
  );
}
