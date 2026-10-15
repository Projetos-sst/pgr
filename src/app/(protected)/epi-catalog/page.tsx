import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { todayInSaoPaulo } from "@/shared/dates";
import {
  classifyDocumentValidity,
  type DocumentValidityStatus,
} from "@/shared/domains/documents/validity";
import { listEpiCatalogAction } from "@/shared/server/actions/pgr/epi-catalog";
import type { CategoryType } from "@/shared/domains/pgr/epi-catalog";

import {
  Cell,
  DataGrid,
  EditIconLink,
  GridHeader,
  GridRow,
  ListCard,
  ListFooter,
  ListToolbar,
  MonoCell,
  RowActions,
  StatusBadge,
  ToolbarButton,
  ToolbarSearch,
} from "../_ui/data-list";
import { EmptyState, PageHeader } from "../_ui/list";
import { DeleteEpiCatalog } from "./_components/delete-epi-catalog";
import { EpiIcon } from "./_components/epi-icon";

export const dynamic = "force-dynamic";

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "epi", label: "EPI" },
  { value: "machine", label: "Máquinas" },
];

const TEMPLATE = "0.9fr 2fr 0.7fr 1.3fr 1.2fr 1fr 84px";

function parseType(value?: string): CategoryType | undefined {
  return value === "epi" || value === "machine" ? value : undefined;
}

/** Validade do CA em MM/AAAA (granularidade do certificado), fiel ao mockup. */
function formatMonthYear(value: string | null): string {
  if (!value) return "—";
  const [year, month] = value.split("-");
  return `${month}/${year}`;
}

/** Cor semântica da Validade derivada na leitura (verde/âmbar/vermelho/cinza). */
const VALIDITY_COLOR: Record<DocumentValidityStatus, string> = {
  ok: "text-accent-green font-semibold",
  due_soon: "text-accent-amber-strong font-semibold",
  expired: "text-danger font-semibold",
  no_expiry: "text-text-subtle",
};

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
  const today = todayInSaoPaulo();

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<EpiIcon />}
        title="Catálogo de EPI"
        description="Itens de EPI e de máquinas/equipamentos do escritório"
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/epi-catalog"
            placeholder="Buscar por CA, nome ou fabricante…"
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
                  href={`/epi-catalog${qs ? `?${qs}` : ""}`}
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
          <ToolbarButton href="/epi-catalog/new">Novo Item</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message={
                hasFilters
                  ? "Nenhum item encontrado para a busca/filtro."
                  : "Nenhum item no catálogo ainda. Cadastre o primeiro item de EPI ou equipamento."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={940}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "CA" },
                  { header: "Nome" },
                  { header: "Tam." },
                  { header: "Fabricante" },
                  { header: "Categoria" },
                  { header: "Validade" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <MonoCell href={`/epi-catalog/${row.id}/edit`}>
                    {row.ca ?? "—"}
                  </MonoCell>
                  <Cell className="text-text font-semibold">{row.name}</Cell>
                  <Cell>{row.size ?? "—"}</Cell>
                  <Cell>{row.manufacturer ?? "—"}</Cell>
                  <Cell>
                    <StatusBadge tone={row.type === "epi" ? "indigo" : "neutral"}>
                      {row.categoryName}
                    </StatusBadge>
                  </Cell>
                  <Cell
                    className={
                      VALIDITY_COLOR[
                        classifyDocumentValidity(row.caValidUntil, {
                          today,
                          dueWindowDays: 30,
                        })
                      ]
                    }
                  >
                    {formatMonthYear(row.caValidUntil)}
                  </Cell>
                  <Cell align="right">
                    <RowActions>
                      <EditIconLink href={`/epi-catalog/${row.id}/edit`} />
                      <DeleteEpiCatalog id={row.id} />
                    </RowActions>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/epi-catalog"
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
