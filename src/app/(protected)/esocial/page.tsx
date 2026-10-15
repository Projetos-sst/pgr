import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { EVENT_STATUS_LABELS } from "@/shared/domains/esocial/events";
import {
  getEsocialDashboardAction,
  listBatchesAction,
  listEventsAction,
} from "@/shared/server/actions/esocial/events";

import Link from "next/link";

import { PageHeader } from "../_ui/list";
import { EsocialIcon } from "./_components/esocial-icon";
import { EsocialDashboardPanel } from "./_components/esocial-dashboard";
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
  const [eventsResult, batchesResult, dashboardResult] = await Promise.all([
    listEventsAction({
      status: sp.status as never,
      dateFrom: sp.dateFrom,
      dateTo: sp.dateTo,
    }),
    listBatchesAction(),
    getEsocialDashboardAction(),
  ]);
  const events = eventsResult.ok ? eventsResult.data.rows : [];
  const dashboard = dashboardResult.ok ? dashboardResult.data : null;
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
        action={
          <Link
            href="/esocial/config"
            className="glass-input text-text-muted hover:text-text flex h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-bold transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" />
            </svg>
            Configurações
          </Link>
        }
      />

      {dashboard ? <EsocialDashboardPanel data={dashboard} /> : null}

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
