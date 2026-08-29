import Link from "next/link";

import { listEmployeesAction } from "@/shared/server/actions/pgr/employees";
import { PAGE_SIZE_MAX } from "@/shared/pagination";

/**
 * Lista os funcionários vinculados a este GES — expostos aos riscos já
 * cadastrados — cada um com um atalho para emitir a Ordem de Serviço
 * correspondente (issue #18).
 */
export async function ExposedEmployeesSection({ gesId }: { gesId: string }) {
  const result = await listEmployeesAction({ gesId, pageSize: PAGE_SIZE_MAX });
  const employees = result.ok ? result.data.rows : [];

  return (
    <section className="glass-card flex flex-col gap-3 p-4">
      <header>
        <h2 className="text-text text-lg font-semibold">
          Funcionários expostos e Ordens de Serviço
        </h2>
        <p className="text-text-subtle text-sm">
          Funcionários vinculados a este GES, prontos para emissão da Ordem de Serviço
          com os riscos já cadastrados.
        </p>
      </header>

      {employees.length === 0 ? (
        <p className="text-text-subtle text-sm">
          Nenhum funcionário vinculado a este GES ainda.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {employees.map((employee) => (
            <li
              key={employee.id}
              className="glass-panel rounded-card flex flex-wrap items-center justify-between gap-3 px-3 py-2"
            >
              <span className="text-text font-medium">{employee.fullName}</span>
              <Link
                href={`/service-orders/new?employeeId=${employee.id}`}
                className="btn-primary rounded-pill px-4 py-1.5 text-sm font-semibold"
              >
                Emitir Ordem de Serviço
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
