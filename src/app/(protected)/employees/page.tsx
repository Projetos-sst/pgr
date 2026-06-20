import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listEmployeesAction } from "@/shared/server/actions/pgr/employees";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { EmptyState, PageHeader, Pagination, PrimaryLink, Table } from "../_ui/list";
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
          className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-zinc-900"
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
          className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-zinc-900"
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
          className="w-full max-w-xs rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15"
        >
          Filtrar
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState message="Nenhum funcionário encontrado." />
      ) : (
        <Table headers={["Nome", "Empresa", "GES", "Status", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-black/5 dark:border-white/5">
              <td className="px-4 py-2">
                <Link href={`/employees/${row.id}`} className="font-medium hover:underline">
                  {row.fullName}
                </Link>
              </td>
              <td className="px-4 py-2">{row.companyName}</td>
              <td className="px-4 py-2">{row.gesName ?? "—"}</td>
              <td className="px-4 py-2">{STATUS_LABEL[row.status] ?? row.status}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/employees/${row.id}/edit`}
                    className="rounded-md border border-black/15 px-3 py-1 text-sm transition-colors hover:bg-black/5 dark:border-white/15"
                  >
                    Editar
                  </Link>
                  <DeleteEmployee id={row.id} />
                </div>
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
