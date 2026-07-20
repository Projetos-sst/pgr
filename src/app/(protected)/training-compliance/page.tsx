import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listNonComplianceAction } from "@/shared/server/actions/pgr/job-role-required-trainings";

import { EmptyState, PageHeader, Table } from "../_ui/list";
import { TrainingStatusBadge } from "../_ui/training-status-badge";

export const dynamic = "force-dynamic";

function formatIsoDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function TrainingCompliancePage() {
  await requireOfficeStaffPage();
  const result = await listNonComplianceAction();
  const rows = result.ok ? result.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Conformidade de Treinamentos"
        description="Funcionários não-conformes com os treinamentos obrigatórios da própria função (obrigatório ausente ou vencido)."
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhum funcionário não-conforme — todos os obrigatórios estão em dia." />
      ) : (
        <Table
          headers={[
            "Funcionário",
            "Treinamento obrigatório",
            "Última realização",
            "Validade",
            "Status",
          ]}
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
                {row.completedAt ? formatIsoDate(row.completedAt) : "Nunca realizado"}
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
