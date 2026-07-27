import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listCompaniesAction } from "@/shared/server/actions/pgr/companies";

import {
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  SearchForm,
  Table,
} from "../_ui/list";
import { EditRowAction, RowActions } from "../_ui/row-actions";
import { DeleteCompany } from "./_components/delete-company";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ search?: string; page?: string }>;

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listCompaniesAction({ search: sp.search, page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Empresas"
        description="Empresas-cliente do escritório (raiz da cadeia do PGR)."
        action={<PrimaryLink href="/companies/new">Nova empresa</PrimaryLink>}
      />
      <SearchForm
        basePath="/companies"
        placeholder="Buscar por razão social ou CNPJ"
        defaultValue={sp.search}
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhuma empresa encontrada." />
      ) : (
        <Table headers={["Razão social", "CNPJ", "Cidade/UF", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2">
                <Link
                  href={`/companies/${row.id}/edit`}
                  className="font-medium hover:underline"
                >
                  {row.razaoSocial}
                </Link>
              </td>
              <td className="px-4 py-2">{row.cnpj ?? "—"}</td>
              <td className="px-4 py-2">
                {[row.city, row.state].filter(Boolean).join("/") || "—"}
              </td>
              <td className="px-4 py-2">
                <RowActions>
                  <EditRowAction href={`/companies/${row.id}/edit`} />
                  <DeleteCompany id={row.id} />
                </RowActions>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/companies"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ search: sp.search }}
      />
    </div>
  );
}
