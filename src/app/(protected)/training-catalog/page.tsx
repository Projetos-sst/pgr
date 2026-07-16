import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listTrainingCatalogAction } from "@/shared/server/actions/pgr/training-catalog";
import { trainingPeriodicityLabel } from "@/shared/domains/pgr/trainings";

import {
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  SearchForm,
  Table,
} from "../_ui/list";
import { DeleteTrainingCatalog } from "./_components/delete-training-catalog";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ search?: string; page?: string }>;

export default async function TrainingCatalogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listTrainingCatalogAction({ search: sp.search, page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Catálogo de Treinamentos"
        description="Treinamentos oferecidos pelo escritório (norma, carga horária e periodicidade)."
        action={<PrimaryLink href="/training-catalog/new">Novo treinamento</PrimaryLink>}
      />

      <SearchForm
        basePath="/training-catalog"
        placeholder="Buscar por nome ou norma"
        defaultValue={sp.search}
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhum treinamento cadastrado. Cadastre o primeiro treinamento do catálogo para registrar realizações." />
      ) : (
        <Table headers={["Nome", "Norma", "Carga horária", "Periodicidade", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2">
                <Link
                  href={`/training-catalog/${row.id}/edit`}
                  className="font-medium hover:underline"
                >
                  {row.name}
                </Link>
              </td>
              <td className="px-4 py-2">{row.referenceNorm ?? "—"}</td>
              <td className="px-4 py-2">{row.workloadHours}h</td>
              <td className="px-4 py-2">{trainingPeriodicityLabel(row.periodicity)}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/training-catalog/${row.id}/edit`}
                    className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
                  >
                    Editar
                  </Link>
                  <DeleteTrainingCatalog id={row.id} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/training-catalog"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ search: sp.search }}
      />
    </div>
  );
}
