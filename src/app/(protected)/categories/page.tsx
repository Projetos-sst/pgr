import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listCategoriesAction } from "@/shared/server/actions/pgr/categories";
import type { CategoryType } from "@/shared/domains/pgr/categories";

import {
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  SearchForm,
  Table,
} from "../_ui/list";
import { EditRowAction, RowActions } from "../_ui/row-actions";
import { DeleteCategory } from "./_components/delete-category";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<CategoryType, string> = { epi: "EPI", machine: "Máquina" };

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "epi", label: "EPI" },
  { value: "machine", label: "Máquina" },
];

function parseType(value?: string): CategoryType | undefined {
  return value === "epi" || value === "machine" ? value : undefined;
}

type SearchParams = Promise<{ search?: string; page?: string; type?: string }>;

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const type = parseType(sp.type);
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listCategoriesAction({ search: sp.search, type, page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Categorias"
        description="Catálogo de EPIs e máquinas do escritório."
        action={<PrimaryLink href="/categories/new">Nova categoria</PrimaryLink>}
      />

      <div className="flex flex-wrap items-center gap-2">
        {TYPE_FILTERS.map((filter) => {
          const active = (sp.type ?? "") === filter.value;
          const query = new URLSearchParams();
          if (filter.value) query.set("type", filter.value);
          if (sp.search) query.set("search", sp.search);
          const qs = query.toString();
          return (
            <Link
              key={filter.label}
              href={`/categories${qs ? `?${qs}` : ""}`}
              className={`rounded-pill px-3 py-1 text-sm font-semibold transition-colors ${
                active ? "btn-primary" : "glass-panel text-text-muted hover:text-text"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <SearchForm
        basePath="/categories"
        placeholder="Buscar por nome"
        defaultValue={sp.search}
        hidden={{ type: sp.type }}
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhuma categoria encontrada." />
      ) : (
        <Table headers={["Nome", "Tipo", "Observação", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2">
                <Link
                  href={`/categories/${row.id}/edit`}
                  className="font-medium hover:underline"
                >
                  {row.name}
                </Link>
              </td>
              <td className="px-4 py-2">{TYPE_LABELS[row.type]}</td>
              <td className="px-4 py-2">{row.note ?? "—"}</td>
              <td className="px-4 py-2">
                <RowActions>
                  <EditRowAction href={`/categories/${row.id}/edit`} />
                  <DeleteCategory id={row.id} />
                </RowActions>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/categories"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ search: sp.search, type: sp.type }}
      />
    </div>
  );
}
