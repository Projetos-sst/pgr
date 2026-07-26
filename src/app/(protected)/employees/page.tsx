import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listEmployeesAction } from "@/shared/server/actions/pgr/employees";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { EmptyState, PageHeader, Pagination, PrimaryLink, Table } from "../_ui/list";
import { EditRowAction, RowActions, ViewRowAction } from "../_ui/row-actions";
import { DeleteEmployee } from "./_components/delete-employee";

export const dynamic = "force-dynamic";

const STATUS_FILTER = [
  { value: "", label: "Todos os status" },
  { value: "active", label: "Ativos" },
  { value: "on_leave", label: "Afastados" },
  { value: "dismissed", label: "Desligados" },
];

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  on_leave: "Afastado",
  dismissed: "Desligado",
};

type SearchParams = Promise<{
  search?: string;
  page?: string;
  companyId?: string;
  status?: string;
}>;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const [listResult, companiesResult] = await Promise.all([
    listEmployeesAction({
      search: sp.search,
      companyId: sp.companyId,
      status: sp.status,
      page,
    }),
    listCompanyOptionsAction(),
  ]);
  const { rows, total } = listResult.ok ? listResult.data : { rows: [], total: 0 };
  const companies = companiesResult.ok ? companiesResult.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Funcionários"
        description="Pessoas vinculadas às empresas-cliente."
        action={<PrimaryLink href="/employees/new">Novo funcionário</PrimaryLink>}
      />

      <form action="/employees" method="get" className="flex flex-wrap gap-2">
        <select
          name="companyId"
          defaultValue={sp.companyId ?? ""}
          className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
        >
          <option value="">Todas as empresas</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.razaoSocial}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
        >
          {STATUS_FILTER.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          name="search"
          defaultValue={sp.search ?? ""}
          placeholder="Buscar por nome, GES ou função"
          className="glass-input text-text rounded-card w-full max-w-xs px-3 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
        >
          Filtrar
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState message="Nenhum funcionário encontrado." />
      ) : (
        <Table headers={["Nome", "Empresa", "GES", "Status", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2">
                <Link
                  href={`/employees/${row.id}`}
                  className="font-medium hover:underline"
                >
                  {row.fullName}
                </Link>
              </td>
              <td className="px-4 py-2">{row.companyName}</td>
              <td className="px-4 py-2">{row.gesName ?? "—"}</td>
              <td className="px-4 py-2">{STATUS_LABEL[row.status] ?? row.status}</td>
              <td className="px-4 py-2">
                <RowActions>
                  <ViewRowAction href={`/employees/${row.id}`} />
                  <EditRowAction href={`/employees/${row.id}/edit`} />
                  <DeleteEmployee id={row.id} />
                </RowActions>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/employees"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ search: sp.search, companyId: sp.companyId, status: sp.status }}
      />
    </div>
  );
}
