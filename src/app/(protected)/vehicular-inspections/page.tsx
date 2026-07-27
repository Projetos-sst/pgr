import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  INSPECTION_STATUS_LABELS,
  vehicularInspectionNumber,
} from "@/shared/domains/inspections/vehicular-inspections";
import { resolvePageParams } from "@/shared/pagination";
import { listVehicularInspectionsAction } from "@/shared/server/actions/inspections/vehicular-inspections";

import { AutoSubmitSelect } from "../_ui/auto-submit-select";
import {
  EmptyState,
  ListCard,
  ListToolbar,
  PageHeader,
  Pagination,
  PrimaryLink,
  Table,
} from "../_ui/list";
import { ChecklistRowAction, EditRowAction, RowActions } from "../_ui/row-actions";
import { StatusBadge, type StatusTone } from "../_ui/status-badge";
import { DeleteInspection } from "./_components/delete-inspection";
import { VehicleIcon } from "./_components/vehicle-icon";

export const dynamic = "force-dynamic";

const BASE = "/vehicular-inspections";

const STATUS_TONES: Record<string, StatusTone> = {
  completed: "green",
  in_progress: "amber",
  pending: "neutral",
  cancelled: "red",
};

function formatIsoDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("pt-BR");
}

type SearchParams = Promise<{ page?: string; status?: string; search?: string }>;

export default async function InspecoesVeicularesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listVehicularInspectionsAction({
    page,
    status: sp.status,
    search: sp.search,
  });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const hasFilters = Boolean(sp.status || sp.search);

  return (
    <div className="animate-fade-slide-up mx-auto flex w-full max-w-[1320px] flex-col gap-[22px] px-5 pt-8 pb-10 sm:px-[30px]">
      <PageHeader
        title="Inspeções Veiculares"
        description="Checklists de inspeção aplicados à frota"
        icon={<VehicleIcon />}
      />

      <ListCard>
        <ListToolbar>
          <form
            action={BASE}
            method="get"
            className="flex flex-1 flex-wrap items-center gap-3"
          >
            <div className="glass-input rounded-card flex h-11 min-w-[200px] flex-1 items-center gap-2.5 px-4 focus-within:border-[var(--color-primary)] focus-within:shadow-[0_0_0_3px_var(--color-primary-ring)]">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                aria-hidden
                className="text-text-subtle shrink-0"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4-4" />
              </svg>
              <label htmlFor="search" className="sr-only">
                Buscar inspeções
              </label>
              <input
                id="search"
                name="search"
                defaultValue={sp.search ?? ""}
                placeholder="Buscar por placa ou responsável…"
                className="text-text placeholder:text-text-subtle w-full bg-transparent text-[13px] outline-none"
              />
            </div>

            <label htmlFor="status" className="sr-only">
              Filtrar por status
            </label>
            <AutoSubmitSelect
              id="status"
              name="status"
              defaultValue={sp.status}
              emptyLabel="Todos os Status"
              options={Object.entries(INSPECTION_STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </form>

          <PrimaryLink href={`${BASE}/new`}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nova Inspeção
          </PrimaryLink>
        </ListToolbar>

        {rows.length === 0 ? (
          <EmptyState
            isFlat
            message={
              hasFilters
                ? "Nenhuma inspeção veicular corresponde aos filtros aplicados."
                : "Nenhuma inspeção veicular registrada até agora."
            }
          />
        ) : (
          <>
            <Table
              isBare
              isZebra
              headers={[
                "Nº",
                "Plano",
                "Placa",
                "Data",
                "Responsável",
                "Status",
                "Opções",
              ]}
            >
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-[11px] whitespace-nowrap sm:px-6">
                    <Link
                      href={`${BASE}/${row.id}`}
                      className="text-primary font-mono font-semibold hover:underline"
                    >
                      {vehicularInspectionNumber(row.id)}
                    </Link>
                  </td>
                  <td className="text-text px-4 py-[11px] font-semibold sm:px-6">
                    {row.planTitle ?? "—"}
                  </td>
                  <td className="text-text-muted px-4 py-[11px] font-mono font-semibold whitespace-nowrap sm:px-6">
                    {row.vehiclePlate ?? "—"}
                  </td>
                  <td className="text-text-muted px-4 py-[11px] font-semibold whitespace-nowrap tabular-nums sm:px-6">
                    {formatIsoDate(row.inspectedAt)}
                  </td>
                  <td className="px-4 py-[11px] sm:px-6">{row.responsible ?? "—"}</td>
                  <td className="px-4 py-[11px] sm:px-6">
                    <StatusBadge
                      tone={STATUS_TONES[row.status] ?? "neutral"}
                      label={row.statusLabel}
                    />
                  </td>
                  <td className="px-4 py-[11px] sm:px-6">
                    <RowActions>
                      <ChecklistRowAction href={`${BASE}/${row.id}`} />
                      <EditRowAction href={`${BASE}/${row.id}/edit`} />
                      <DeleteInspection id={row.id} />
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
              params={{ status: sp.status, search: sp.search }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
