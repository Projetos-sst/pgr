import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listWorkUnitsAction } from "@/shared/server/actions/pgr/work-units";

import {
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  SearchForm,
  Table,
} from "../_ui/list";
import { DeleteWorkUnit } from "./_components/delete-work-unit";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ search?: string; page?: string; companyId?: string }>;

export default async function WorkUnitsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listWorkUnitsAction({
    search: sp.search,
    companyId: sp.companyId,
    page,
  });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Unidades de obra"
        description="Canteiros, filiais e locais por empresa."
        action={<PrimaryLink href="/work-units/new">Nova unidade</PrimaryLink>}
      />
      <SearchForm
        basePath="/work-units"
        placeholder="Buscar por nome, contrato ou objeto"
        defaultValue={sp.search}
        hidden={{ companyId: sp.companyId }}
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhuma unidade de obra encontrada." />
      ) : (
        <Table headers={["Nome", "Contrato", "Cidade/UF", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-black/5 dark:border-white/5">
              <td className="px-4 py-2">
                <Link href={`/work-units/${row.id}/edit`} className="font-medium hover:underline">
                  {row.name}
                </Link>
              </td>
              <td className="px-4 py-2">{row.contractNumber ?? "—"}</td>
              <td className="px-4 py-2">
                {[row.city, row.state].filter(Boolean).join("/") || "—"}
              </td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/work-units/${row.id}/edit`}
                    className="rounded-md border border-black/15 px-3 py-1 text-sm transition-colors hover:bg-black/5 dark:border-white/15"
                  >
                    Editar
                  </Link>
                  <DeleteWorkUnit id={row.id} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/work-units"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ search: sp.search, companyId: sp.companyId }}
      />
    </div>
  );
}
