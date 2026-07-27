import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listWorkPermitsAction } from "@/shared/server/actions/work-permits/work-permits";

import {
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  SearchForm,
  Table,
} from "../_ui/list";
import { EditRowAction, RowActions } from "../_ui/row-actions";
import { DeletePermit } from "./_components/delete-permit";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ search?: string; page?: string }>;

export default async function PermissoesTrabalhoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listWorkPermitsAction({ search: sp.search, page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Permissões de trabalho (PT)"
        description="Autorizações para trabalhos de risco (a quente, em altura, espaço confinado, etc)."
        action={<PrimaryLink href="/work-permits/new">Nova PT</PrimaryLink>}
      />
      <SearchForm
        basePath="/work-permits"
        placeholder="Buscar por número/descrição"
        defaultValue={sp.search}
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhuma permissão de trabalho." />
      ) : (
        <Table headers={["Número", "Tipo", "Empresa", "Validade", "Status", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2">
                <Link
                  href={`/work-permits/${row.id}/edit`}
                  className="font-medium hover:underline"
                >
                  {row.number}
                </Link>
              </td>
              <td className="px-4 py-2">{row.typeLabel}</td>
              <td className="px-4 py-2">{row.companyName ?? "—"}</td>
              <td className="px-4 py-2 tabular-nums">
                {row.validFrom} → {row.validUntil}
              </td>
              <td className="px-4 py-2">{row.statusLabel}</td>
              <td className="px-4 py-2">
                <RowActions>
                  <EditRowAction href={`/work-permits/${row.id}/edit`} />
                  <DeletePermit id={row.id} />
                </RowActions>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/work-permits"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ search: sp.search }}
      />
    </div>
  );
}
