import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  getTrainingDueSummaryAction,
  listTrainingExpiryAction,
} from "@/shared/server/actions/pgr/training-records";
import { listEmployeesAction } from "@/shared/server/actions/pgr/employees";
import {
  DUE_WINDOW_DAYS_OPTIONS,
  parseDueWindowDays,
} from "@/shared/domains/pgr/trainings";

import { EmptyState, PageHeader, Table } from "../_ui/list";
import { TrainingStatusBadge } from "../_ui/training-status-badge";

export const dynamic = "force-dynamic";

function formatIsoDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("pt-BR");
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col rounded-lg border border-black/10 px-4 py-3 dark:border-white/10">
      <span className="text-xs tracking-wide text-zinc-500 uppercase">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
    </div>
  );
}

type SearchParams = Promise<{ window?: string; employeeId?: string }>;

export default async function TrainingExpiryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const dueWithinDays = parseDueWindowDays(sp.window);
  const employeeId = sp.employeeId || undefined;

  const [expiryResult, summaryResult, employeesResult] = await Promise.all([
    listTrainingExpiryAction({ employeeId, dueWithinDays }),
    getTrainingDueSummaryAction(),
    listEmployeesAction({ pageSize: 100 }),
  ]);

  const rows = expiryResult.ok ? expiryResult.data : [];
  const summary = summaryResult.ok ? summaryResult.data : { expired: 0, dueSoon: 0 };
  const employeeOptions = employeesResult.ok ? employeesResult.data.rows : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Vencimento de Treinamentos"
        description="Vencidos e a vencer por funcionário — apenas o último registro de cada treinamento conta; periodicidade única não expira."
      />

      <div className="grid max-w-md grid-cols-2 gap-4">
        <SummaryCard label="Vencidos" value={summary.expired} />
        <SummaryCard label="A vencer (30 dias)" value={summary.dueSoon} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-zinc-500">Janela:</span>
        {DUE_WINDOW_DAYS_OPTIONS.map((days) => {
          const active = dueWithinDays === days;
          const query = new URLSearchParams({ window: String(days) });
          if (employeeId) query.set("employeeId", employeeId);
          return (
            <Link
              key={days}
              href={`/training-expiry?${query.toString()}`}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                active
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-black/15 hover:bg-black/5 dark:border-white/15"
              }`}
            >
              {days} dias
            </Link>
          );
        })}
      </div>

      <form action="/training-expiry" method="get" className="flex items-end gap-2">
        <input type="hidden" name="window" value={dueWithinDays} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Funcionário</span>
          <select
            name="employeeId"
            defaultValue={employeeId ?? ""}
            className="w-full max-w-xs rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-zinc-900"
          >
            <option value="">Todos</option>
            {employeeOptions.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15"
        >
          Filtrar
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState message="Nenhum treinamento com validade para acompanhar — tudo em dia por aqui." />
      ) : (
        <Table
          headers={["Funcionário", "Treinamento", "Realização", "Validade", "Status"]}
        >
          {rows.map((row) => (
            <tr
              key={`${row.employeeId}-${row.trainingId}`}
              className="border-t border-black/5 dark:border-white/5"
            >
              <td className="px-4 py-2">
                <Link
                  href={`/employees/${row.employeeId}`}
                  className="font-medium hover:underline"
                >
                  {row.employeeName}
                </Link>
              </td>
              <td className="px-4 py-2">{row.trainingName}</td>
              <td className="px-4 py-2">
                {row.completedAt ? formatIsoDate(row.completedAt) : "—"}
              </td>
              <td className="px-4 py-2">
                {row.validUntil ? formatIsoDate(row.validUntil) : "—"}
              </td>
              <td className="px-4 py-2">
                <TrainingStatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
