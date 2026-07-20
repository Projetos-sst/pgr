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
    <div className="glass-card flex flex-col px-4 py-3">
      <span className="text-text-subtle text-xs tracking-wide uppercase">{label}</span>
      <span className="text-text text-2xl font-semibold">{value}</span>
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
        <span className="text-text-subtle text-sm">Janela:</span>
        {DUE_WINDOW_DAYS_OPTIONS.map((days) => {
          const active = dueWithinDays === days;
          const query = new URLSearchParams({ window: String(days) });
          if (employeeId) query.set("employeeId", employeeId);
          return (
            <Link
              key={days}
              href={`/training-expiry?${query.toString()}`}
              className={`rounded-pill px-3 py-1 text-sm font-semibold transition-colors ${
                active ? "btn-primary" : "glass-panel text-text-muted hover:text-text"
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
          <span className="text-text-muted font-semibold">Funcionário</span>
          <select
            name="employeeId"
            defaultValue={employeeId ?? ""}
            className="glass-input text-text rounded-card w-full max-w-xs px-3 py-2 text-sm outline-none"
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
          className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
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
              className="border-t border-white/50"
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
