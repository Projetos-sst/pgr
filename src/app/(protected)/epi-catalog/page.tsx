import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listEpiCatalogAction } from "@/shared/server/actions/pgr/epi-catalog";
import type { CategoryType } from "@/shared/domains/pgr/epi-catalog";

import {
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  SearchForm,
  Table,
} from "../_ui/list";
import { DeleteEpiCatalog } from "./_components/delete-epi-catalog";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<CategoryType, string> = {
  epi: "EPI",
  machine: "Máquinas e Equipamentos",
};

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "epi", label: "EPI" },
  { value: "machine", label: "Máquinas e Equipamentos" },
];

function parseType(value?: string): CategoryType | undefined {
  return value === "epi" || value === "machine" ? value : undefined;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

type SearchParams = Promise<{ search?: string; page?: string; type?: string }>;

export default async function EpiCatalogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const type = parseType(sp.type);
  const hasFilters = Boolean(sp.search?.trim()) || type !== undefined;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listEpiCatalogAction({ search: sp.search, type, page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Catálogo de EPI"
        description="Itens de EPI e de máquinas/equipamentos do escritório."
        action={<PrimaryLink href="/epi-catalog/new">Novo item</PrimaryLink>}
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
              href={`/epi-catalog${qs ? `?${qs}` : ""}`}
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
        basePath="/epi-catalog"
        placeholder="Buscar por nome, CA ou categoria"
        defaultValue={sp.search}
        hidden={{ type: sp.type }}
      />

      {rows.length === 0 ? (
        <EmptyState
          message={
            hasFilters
              ? "Nenhum item encontrado para a busca/filtro."
              : "Nenhum item no catálogo ainda. Cadastre o primeiro item de EPI ou equipamento."
          }
        />
      ) : (
        <Table
          headers={[
            "CA",
            "Nome",
            "Tam.",
            "Fabricante",
            "Tipo",
            "Categoria",
            "Und. Medida",
            "Validade",
            "Opções",
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2">{row.ca ?? "—"}</td>
              <td className="px-4 py-2">
                <Link
                  href={`/epi-catalog/${row.id}/edit`}
                  className="font-medium hover:underline"
                >
                  {row.name}
                </Link>
              </td>
              <td className="px-4 py-2">{row.size ?? "—"}</td>
              <td className="px-4 py-2">{row.manufacturer ?? "—"}</td>
              <td className="px-4 py-2">{TYPE_LABELS[row.type]}</td>
              <td className="px-4 py-2">{row.categoryName}</td>
              <td className="px-4 py-2">{row.unitOfMeasure ?? "—"}</td>
              <td className="px-4 py-2">{formatDate(row.caValidUntil)}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/epi-catalog/${row.id}/edit`}
                    className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
                  >
                    Editar
                  </Link>
                  <DeleteEpiCatalog id={row.id} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/epi-catalog"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ search: sp.search, type: sp.type }}
      />
    </div>
  );
}
