import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import {
  epiStockStatusSchema,
  type EpiStockStatus,
  type EpiStockListItem,
} from "@/shared/domains/pgr/epi-stock";
import { listEpiStockAction } from "@/shared/server/actions/pgr/epi-stock";

import { EmptyState, PageHeader } from "../_ui/list";
import { EditRowAction, RowActions, ViewRowAction } from "../_ui/row-actions";
import { DeleteEpiStock } from "./_components/delete-epi-stock";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  search?: string;
  page?: string;
  status?: string;
  withBalanceOnly?: string;
}>;

const STATUS_TABS: { value: "" | EpiStockStatus; label: string; icon?: string }[] = [
  { value: "", label: "Todos" },
  { value: "sem_saldo", label: "Sem Saldo" },
  { value: "abaixo_minima", label: "Abaixo da Mínima" },
  { value: "acima_minima", label: "Acima da Mínima" },
];

/** Badge de saldo colorido conforme status, exibe quantidade + unidade. */
function StockBalanceBadge({ item }: { item: EpiStockListItem }) {
  const unit = item.unitOfMeasure ?? "un";
  const qty = item.currentBalance;
  const status = item.status;

  if (status === "sem_saldo") {
    return (
      <span
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color: "#e5484d",
          background: "rgba(229, 72, 77, 0.12)",
          padding: "4px 11px",
          borderRadius: "20px",
          whiteSpace: "nowrap",
        }}
      >
        {qty} {unit}
      </span>
    );
  }
  if (status === "abaixo_minima") {
    return (
      <span
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color: "#f5a524",
          background: "rgba(245, 165, 36, 0.14)",
          padding: "4px 11px",
          borderRadius: "20px",
          whiteSpace: "nowrap",
        }}
      >
        {qty} {unit}
      </span>
    );
  }
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 700,
        color: "#0e9f6e",
        background: "rgba(16, 185, 129, 0.12)",
        padding: "4px 11px",
        borderRadius: "20px",
        whiteSpace: "nowrap",
      }}
    >
      {qty} {unit}
    </span>
  );
}

/** Ícone SVG de box 3D para o header. */
function BoxIcon() {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 7v10l9 4 9-4V7M12 11v10" />
    </svg>
  );
}

export default async function EpiStockPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const status = epiStockStatusSchema.safeParse(sp.status);
  const withBalanceOnly = sp.withBalanceOnly === "true";
  const activeStatus = status.success ? status.data : "";

  const result = await listEpiStockAction({
    search: sp.search,
    status: status.success ? status.data : undefined,
    withBalanceOnly,
    page,
  });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  // Monta query string preservando filtros ativos
  function buildTabHref(tabStatus: "" | EpiStockStatus) {
    const params = new URLSearchParams();
    if (tabStatus) params.set("status", tabStatus);
    if (sp.search) params.set("search", sp.search);
    if (withBalanceOnly) params.set("withBalanceOnly", "true");
    const qs = params.toString();
    return `/epi-stock${qs ? `?${qs}` : ""}`;
  }

  function buildToggleHref() {
    const params = new URLSearchParams();
    if (activeStatus) params.set("status", activeStatus);
    if (sp.search) params.set("search", sp.search);
    if (!withBalanceOnly) params.set("withBalanceOnly", "true");
    const qs = params.toString();
    return `/epi-stock${qs ? `?${qs}` : ""}`;
  }

  // Descrição dinâmica com contagem de itens abaixo da mínima
  const belowMin = rows.filter(
    (r) => r.status === "abaixo_minima" || r.status === "sem_saldo",
  ).length;
  const description =
    belowMin > 0
      ? `Saldo e reposição de equipamentos · ${belowMin} ${belowMin === 1 ? "item" : "itens"} abaixo da mínima`
      : "Saldo e reposição de equipamentos de proteção individual";

  return (
    <div className="animate-fade-slide-up flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Estoque de EPI"
        description={description}
        icon={<BoxIcon />}
        action={
          <Link
            href="/epi-stock/new"
            className="btn-primary hover-lift rounded-card shadow-primary flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-all"
          >
            Adicionar ao estoque
          </Link>
        }
      />

      {/* Card glass principal — contém filtros, busca, tabela e paginação */}
      <div
        className="glass-card animate-fade-in overflow-hidden"
        style={{ borderRadius: "20px" }}
      >
        {/* Linha 1: Tabs de filtro de status + toggle "Apenas com saldo" */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(120, 120, 150, 0.1)",
            flexWrap: "wrap",
          }}
        >
          {STATUS_TABS.map((tab) => {
            const isActive = activeStatus === tab.value;
            return (
              <Link
                key={tab.value}
                href={buildTabHref(tab.value)}
                aria-current={isActive ? "page" : undefined}
                className="transition-all hover:opacity-90 active:scale-95"
                style={{
                  height: "38px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "0 15px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: isActive ? 700 : 600,
                  textDecoration: "none",
                  ...(isActive
                    ? {
                        background: "#5b63f5",
                        color: "#fff",
                        boxShadow: "0 4px 12px rgba(91, 99, 245, 0.3)",
                      }
                    : tab.value === "abaixo_minima"
                      ? {
                          color: "#e5484d",
                          background: "rgba(229, 72, 77, 0.1)",
                        }
                      : tab.value === "acima_minima"
                        ? {
                            color: "#0e9f6e",
                          }
                        : {
                            color: "#52576e",
                          }),
                }}
              >
                {tab.value === "abaixo_minima" && !isActive && (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                )}
                {tab.value === "acima_minima" && !isActive && (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                )}
                {tab.label}
              </Link>
            );
          })}

          {/* Toggle "Apenas com saldo" */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#52576e",
            }}
          >
            <Link
              href={buildToggleHref()}
              aria-pressed={withBalanceOnly}
              aria-label={
                withBalanceOnly
                  ? "Mostrar todos os itens"
                  : "Mostrar apenas itens com saldo"
              }
              style={{
                width: "34px",
                height: "20px",
                borderRadius: "20px",
                background: withBalanceOnly ? "#5b63f5" : "rgba(0,0,0,0.12)",
                position: "relative",
                display: "inline-block",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "2px",
                  right: withBalanceOnly ? "2px" : undefined,
                  left: withBalanceOnly ? undefined : "2px",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.2s, right 0.2s",
                }}
              />
            </Link>
            Apenas com saldo
          </div>
        </div>

        {/* Linha 2: Campo de busca + botão Gerenciar */}
        <form
          action="/epi-stock"
          method="get"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(120, 120, 150, 0.1)",
          }}
        >
          {/* Preservar filtros ativos como hidden inputs */}
          {activeStatus && <input type="hidden" name="status" value={activeStatus} />}
          {withBalanceOnly && <input type="hidden" name="withBalanceOnly" value="true" />}

          {/* Busca */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "10px",
              height: "44px",
              padding: "0 16px",
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.7)",
            }}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9095ad"
              strokeWidth="1.9"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
            <input
              name="search"
              defaultValue={sp.search ?? ""}
              placeholder="Buscar por nome ou CA"
              aria-label="Buscar por nome ou CA"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: "13px",
                color: "#1b1f2e",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Botão Gerenciar Dados → Adicionar ao estoque */}
          <Link
            href="/epi-stock/new"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              height: "44px",
              padding: "0 16px",
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.7)",
              fontSize: "13px",
              fontWeight: 600,
              color: "#52576e",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5b63f5"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <ellipse cx="12" cy="6" rx="8" ry="3" />
              <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
            </svg>
            Gerenciar Dados
            <span style={{ color: "#9095ad" }}>▾</span>
          </Link>
        </form>

        {/* Cabeçalho da tabela */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "0.9fr 2fr 0.6fr 1fr 0.8fr 1fr 120px",
            gap: "14px",
            padding: "14px 24px",
            fontFamily: "var(--font-jetbrains-mono, monospace)",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#9095ad",
            borderBottom: "1px solid rgba(120, 120, 150, 0.12)",
          }}
        >
          <span>CA</span>
          <span>Nome</span>
          <span>Tam.</span>
          <span>Und.</span>
          <span>Mínima</span>
          <span>Saldo</span>
          <span style={{ textAlign: "right" }}>Opç.</span>
        </div>

        {/* Linhas da tabela ou empty state */}
        {rows.length === 0 ? (
          <EmptyState message="Nenhum item no estoque. Comece adicionando um item do catálogo." />
        ) : (
          rows.map((row, idx) => (
            <div
              key={row.id}
              className="transition-all duration-200 hover:bg-white/40"
              style={{
                display: "grid",
                gridTemplateColumns: "0.9fr 2fr 0.6fr 1fr 0.8fr 1fr 120px",
                gap: "14px",
                padding: "18px 24px",
                alignItems: "center",
                fontSize: "13px",
                borderBottom: "1px solid rgba(120, 120, 150, 0.08)",
                background: idx % 2 === 1 ? "rgba(255, 255, 255, 0.2)" : "transparent",
              }}
            >
              {/* CA */}
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono, monospace)",
                  fontWeight: 600,
                  color: "#5b63f5",
                }}
              >
                {row.ca ?? "—"}
              </span>

              {/* Nome */}
              <span style={{ fontWeight: 600 }}>{row.name}</span>

              {/* Tamanho */}
              <span>{row.size ?? "—"}</span>

              {/* Unidade */}
              <span style={{ color: "#797e96" }}>{row.unitOfMeasure ?? "—"}</span>

              {/* Mínima */}
              <span style={{ color: "#797e96" }}>{row.minimumQuantity}</span>

              {/* Saldo — badge colorido */}
              <span>
                <StockBalanceBadge item={row} />
              </span>

              {/* Ações */}
              <span className="flex items-center justify-end">
                <RowActions>
                  <ViewRowAction
                    href={`/epi-stock/${row.id}/history`}
                    label={`Ver histórico de ${row.name}`}
                  />
                  <EditRowAction
                    href={`/epi-stock/${row.id}/edit`}
                    label={`Editar ${row.name}`}
                  />
                  <DeleteEpiStock id={row.id} />
                </RowActions>
              </span>
            </div>
          ))
        )}

        {/* Paginação dentro do card */}
        <EpiStockPagination
          basePath="/epi-stock"
          page={page}
          pageSize={pageSize}
          total={total}
          params={{
            search: sp.search,
            status: activeStatus || undefined,
            withBalanceOnly: withBalanceOnly ? "true" : undefined,
          }}
        />
      </div>
    </div>
  );
}

/** Paginação estilizada igual ao mockup, integrada dentro do card. */
function EpiStockPagination({
  basePath,
  page,
  pageSize,
  total,
  params,
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string | undefined>;
}) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(page, 1), totalPages);
  const startItem = (clampedPage - 1) * pageSize + 1;
  const endItem = Math.min(total, clampedPage * pageSize);

  const maxDisplayed = 5;
  let startPage = Math.max(1, clampedPage - Math.floor(maxDisplayed / 2));
  const endPage = Math.min(totalPages, startPage + maxDisplayed - 1);
  if (endPage - startPage + 1 < maxDisplayed) {
    startPage = Math.max(1, endPage - maxDisplayed + 1);
  }
  const pages: number[] = [];
  for (let i = startPage; i <= endPage; i++) pages.push(i);

  function buildQuery(overrides: Record<string, string>) {
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...overrides })) {
      if (value !== undefined && value !== "") usp.set(key, value);
    }
    const qs = usp.toString();
    return qs ? `?${qs}` : "";
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 24px",
        borderTop: "1px solid rgba(120, 120, 150, 0.12)",
        flexWrap: "wrap",
        gap: "12px",
      }}
    >
      <span style={{ fontSize: "12px", color: "#9095ad" }}>
        Mostrando <strong style={{ color: "#52576e" }}>{startItem}</strong> a{" "}
        <strong style={{ color: "#52576e" }}>{endItem}</strong> de{" "}
        <strong style={{ color: "#52576e" }}>{total}</strong> registros
      </span>

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {clampedPage > 1 ? (
            <Link
              href={`${basePath}${buildQuery({ page: String(clampedPage - 1) })}`}
              aria-label="Página anterior"
              style={pageNavStyle()}
            >
              ‹
            </Link>
          ) : (
            <span style={pageNavStyle(true)}>‹</span>
          )}

          {pages.map((p) =>
            p === clampedPage ? (
              <span key={p} style={pageActiveStyle()}>
                {p}
              </span>
            ) : (
              <Link
                key={p}
                href={`${basePath}${buildQuery({ page: String(p) })}`}
                style={pageInactiveStyle()}
              >
                {p}
              </Link>
            ),
          )}

          {clampedPage < totalPages ? (
            <Link
              href={`${basePath}${buildQuery({ page: String(clampedPage + 1) })}`}
              aria-label="Próxima página"
              style={pageNavStyle()}
            >
              ›
            </Link>
          ) : (
            <span style={pageNavStyle(true)}>›</span>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          color: "#9095ad",
        }}
      >
        Itens por página:
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            height: "32px",
            padding: "0 12px",
            borderRadius: "9px",
            background: "rgba(255, 255, 255, 0.5)",
            border: "1px solid rgba(255, 255, 255, 0.7)",
            fontWeight: 600,
            color: "#52576e",
            fontSize: "12px",
          }}
        >
          {pageSize} ▾
        </span>
      </div>
    </div>
  );
}

function pageNavStyle(disabled = false): React.CSSProperties {
  return {
    width: "32px",
    height: "32px",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    color: disabled ? "#c3c6d4" : "#52576e",
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function pageActiveStyle(): React.CSSProperties {
  return {
    width: "32px",
    height: "32px",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#5b63f5",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 700,
    boxShadow: "0 4px 12px rgba(91, 99, 245, 0.35)",
  };
}

function pageInactiveStyle(): React.CSSProperties {
  return {
    width: "32px",
    height: "32px",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#52576e",
    fontSize: "13px",
    textDecoration: "none",
  };
}
