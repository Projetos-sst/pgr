import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { EVENT_STATUS_LABELS } from "@/shared/domains/esocial/events";
import {
  listBatchesAction,
  listEventsAction,
} from "@/shared/server/actions/esocial/events";

import { PageHeader } from "../_ui/list";
import { EventsTable } from "./_components/events-table";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}>;

export default async function EsocialPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const [eventsResult, batchesResult] = await Promise.all([
    listEventsAction({
      status: sp.status as never,
      dateFrom: sp.dateFrom,
      dateTo: sp.dateTo,
    }),
    listBatchesAction(),
  ]);
  const events = eventsResult.ok ? eventsResult.data.rows : [];
  const batches = batchesResult.ok
    ? batchesResult.data.map((b) => ({
        id: b.id,
        protocolNumber: b.protocolNumber,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
      }))
    : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="eSocial — eventos SST"
        description="Geração, envio em lote e consulta de retorno dos eventos SST (S-2190 a S-2300)."
      />

      <form action="/esocial" method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>Data inicial</span>
          <input
            type="date"
            name="dateFrom"
            defaultValue={sp.dateFrom}
            className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Data final</span>
          <input
            type="date"
            name="dateTo"
            defaultValue={sp.dateTo}
            className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Status</span>
          <select
            name="status"
            defaultValue={sp.status ?? ""}
            className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
          >
            <option value="">Todos</option>
            {Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
        >
          Filtrar
        </button>
      </form>

      <EventsTable events={events} batches={batches} />
    </div>
  );
}
