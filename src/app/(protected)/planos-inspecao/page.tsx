import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listPlansAction } from "@/shared/server/actions/inspections/plans";

import {
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  SearchForm,
  Table,
} from "../_ui/list";
import { DeletePlan } from "./_components/delete-plan";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ search?: string; page?: string }>;

export default async function PlanosInspecaoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listPlansAction({ search: sp.search, page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Planos de inspeção"
        description="Checklists reutilizáveis das inspeções veiculares e de equipamentos."
        action={<PrimaryLink href="/planos-inspecao/new">Novo plano</PrimaryLink>}
      />
      <SearchForm
        basePath="/planos-inspecao"
        placeholder="Buscar por título"
        defaultValue={sp.search}
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhum plano de inspeção." />
      ) : (
        <Table headers={["Título", "Tipo", "Itens", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-black/5 dark:border-white/5">
              <td className="px-4 py-2">
                <Link
                  href={`/planos-inspecao/${row.id}/edit`}
                  className="font-medium hover:underline"
                >
                  {row.title}
                </Link>
              </td>
              <td className="px-4 py-2">{row.typeLabel}</td>
              <td className="px-4 py-2 tabular-nums">{row.itemCount}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/planos-inspecao/${row.id}/edit`}
                    className="rounded-md border border-black/15 px-3 py-1 text-sm transition-colors hover:bg-black/5 dark:border-white/15"
                  >
                    Editar
                  </Link>
                  <DeletePlan id={row.id} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/planos-inspecao"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ search: sp.search }}
      />
    </div>
  );
}
