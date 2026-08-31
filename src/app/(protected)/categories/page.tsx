import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listCategoriesAction } from "@/shared/server/actions/pgr/categories";
import { CATEGORY_TYPE_LABELS, type CategoryType } from "@/shared/domains/pgr/categories";

import {
  AvatarBadge,
  Cell,
  DataGrid,
  EditIconLink,
  GridHeader,
  GridRow,
  ListCard,
  ListFooter,
  ListToolbar,
  RowActions,
  StatusBadge,
  ToolbarButton,
  ToolbarSearch,
} from "../_ui/data-list";
import { EmptyState, PageHeader } from "../_ui/list";
import { CategoryIcon } from "./_components/category-icon";
import { DeleteCategory } from "./_components/delete-category";

export const dynamic = "force-dynamic";

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "epi", label: "EPI" },
  { value: "machine", label: "Máquina" },
  { value: "supply", label: "Insumo" },
];

const TEMPLATE = "1fr 2fr 1.2fr 1.3fr 1.1fr 84px";

function parseType(value?: string): CategoryType | undefined {
  return value === "epi" || value === "machine" || value === "supply" ? value : undefined;
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
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<CategoryIcon />}
        title="Categorias"
        description="Catálogo de EPIs e máquinas do escritório"
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/categories"
            placeholder="Buscar por nome…"
            defaultValue={sp.search}
            hidden={{ type: sp.type }}
          />
          <div className="flex items-center gap-1.5">
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
                  className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                    active
                      ? "btn-primary"
                      : "text-text-muted hover:text-text border border-white/70 bg-white/50"
                  }`}
                >
                  {filter.label}
                </Link>
              );
            })}
          </div>
          <ToolbarButton href="/categories/new">Nova Categoria</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message={
                sp.search
                  ? "Nenhuma categoria encontrada para a busca."
                  : "Nenhuma categoria cadastrada."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={840}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Código" },
                  { header: "Categoria" },
                  { header: "Tipo" },
                  { header: "Itens Vinculados" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <Cell className="text-text-subtle font-mono">—</Cell>
                  <Cell>
                    <span className="flex items-center gap-3">
                      <AvatarBadge name={row.name} />
                      <span className="text-text font-semibold">{row.name}</span>
                    </span>
                  </Cell>
                  <Cell>
                    <StatusBadge tone={row.type === "epi" ? "indigo" : "neutral"}>
                      {CATEGORY_TYPE_LABELS[row.type]}
                    </StatusBadge>
                  </Cell>
                  <Cell className={row.itemCount ? undefined : "text-text-subtle"}>
                    {row.itemCount ? `${row.itemCount} item(ns)` : "—"}
                  </Cell>
                  <Cell>
                    <StatusBadge tone={row.isActive ? "green" : "neutral"}>
                      {row.isActive ? "Ativa" : "Inativa"}
                    </StatusBadge>
                  </Cell>
                  <Cell align="right">
                    <RowActions>
                      <EditIconLink href={`/categories/${row.id}/edit`} />
                      <DeleteCategory id={row.id} />
                    </RowActions>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/categories"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ search: sp.search, type: sp.type }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
