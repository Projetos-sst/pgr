import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { SCHEDULE_EVENT_TYPE_LABELS } from "@/shared/domains/platform/scheduling";
import { resolvePageParams } from "@/shared/pagination";
import { listScheduleEventsAction } from "@/shared/server/actions/platform/scheduling";

import { EmptyState, PageHeader, Pagination, PrimaryLink, Table } from "../_ui/list";
import { DeleteScheduleEvent } from "./_components/delete-schedule-event";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ eventType?: string; page?: string }>;

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listScheduleEventsAction({ eventType: sp.eventType, page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Agenda"
        description="Compromissos de SST: inspeções, treinamentos, exames e vencimentos."
        action={<PrimaryLink href="/agenda/new">Novo evento</PrimaryLink>}
      />

      <form method="get" className="flex gap-2">
        <select
          name="eventType"
          defaultValue={sp.eventType ?? ""}
          className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-zinc-900"
        >
          <option value="">Todos os tipos</option>
          {Object.entries(SCHEDULE_EVENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15"
        >
          Filtrar
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState message="Nenhum evento na agenda." />
      ) : (
        <Table headers={["Data", "Tipo", "Título", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-black/5 dark:border-white/5">
              <td className="px-4 py-2 tabular-nums">{row.eventDate}</td>
              <td className="px-4 py-2">{row.eventTypeLabel}</td>
              <td className="px-4 py-2">
                <Link
                  href={`/agenda/${row.id}/edit`}
                  className="font-medium hover:underline"
                >
                  {row.title}
                </Link>
              </td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/agenda/${row.id}/edit`}
                    className="rounded-md border border-black/15 px-3 py-1 text-sm transition-colors hover:bg-black/5 dark:border-white/15"
                  >
                    Editar
                  </Link>
                  <DeleteScheduleEvent id={row.id} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/agenda"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ eventType: sp.eventType }}
      />
    </div>
  );
}
