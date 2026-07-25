import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { EVENT_STATUS_LABELS } from "@/shared/domains/esocial/events";
import {
  listBatchesAction,
  listEventsAction,
} from "@/shared/server/actions/esocial/events";

import { PageHeader } from "../_ui/list";
import { EsocialIcon } from "./_components/esocial-icon";
import { EventsTable } from "./_components/events-table";

export const dynamic = "force-dynamic";

const filterInput =
  "text-text h-11 rounded-xl border border-white/70 bg-white/50 px-3.5 text-[13px] outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-ring";

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
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<EsocialIcon />}
        title="eSocial — eventos SST"
        description="Geração, envio em lote e retorno dos eventos SST (S-2190 a S-2300)"
      />

      <form
        action="/esocial"
        method="get"
        className="glass-card flex flex-wrap items-end gap-3 rounded-[20px] p-5"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-text-muted text-[12px] font-semibold">Data inicial</span>
          <input
            type="date"
            name="dateFrom"
            defaultValue={sp.dateFrom}
            className={filterInput}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-text-muted text-[12px] font-semibold">Data final</span>
          <input
            type="date"
            name="dateTo"
            defaultValue={sp.dateTo}
            className={filterInput}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-text-muted text-[12px] font-semibold">Status</span>
          <select
            name="status"
            defaultValue={sp.status ?? ""}
            className={`${filterInput} font-semibold`}
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
          className="text-text-muted hover:text-text h-11 rounded-xl border border-white/70 bg-white/50 px-4 text-[13px] font-semibold transition-colors"
        >
          Filtrar
        </button>
      </form>

      <EventsTable events={events} batches={batches} />
    </div>
  );
}
