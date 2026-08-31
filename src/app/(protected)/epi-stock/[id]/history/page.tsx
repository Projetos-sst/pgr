import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { getEpiStockAction } from "@/shared/server/actions/pgr/epi-stock";
import { listStockMovementsAction } from "@/shared/server/actions/pgr/stock-movements";

import { EmptyState, PageHeader } from "../../../_ui/list";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string }>;

/** Data `YYYY-MM-DD` → `dd/mm/aaaa` sem `Date` (evita deslocamento de fuso). */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Ícone SVG de histórico/relógio para o header. */
function HistoryIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

/** Badge colorido para quantidade de movimento (+ verde / − vermelho). */
function MovementQtyBadge({ signedQty, qty }: { signedQty: number; qty: number }) {
  const isPositive = signedQty > 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: "11px",
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: "20px",
        whiteSpace: "nowrap",
        fontFamily: "var(--font-jetbrains-mono, monospace)",
        ...(isPositive
          ? {
              color: "#0e9f6e",
              background: "rgba(16, 185, 129, 0.12)",
            }
          : {
              color: "#e5484d",
              background: "rgba(229, 72, 77, 0.12)",
            }),
      }}
    >
      {isPositive ? `+${qty}` : `−${qty}`}
    </span>
  );
}

export default async function StockHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });

  const stockResult = await getEpiStockAction(id);
  if (!stockResult.ok) notFound();
  const stock = stockResult.data;

  const result = await listStockMovementsAction(id, { page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(page, 1), totalPages);
  const startItem = (clampedPage - 1) * pageSize + 1;
  const endItem = Math.min(total, clampedPage * pageSize);

  const pages: number[] = [];
  const maxDisplayed = 5;
  let startPage = Math.max(1, clampedPage - Math.floor(maxDisplayed / 2));
  const endPage = Math.min(totalPages, startPage + maxDisplayed - 1);
  if (endPage - startPage + 1 < maxDisplayed) {
    startPage = Math.max(1, endPage - maxDisplayed + 1);
  }
  for (let i = startPage; i <= endPage; i++) pages.push(i);

  function buildPageHref(p: number) {
    return `/epi-stock/${id}/history${p > 1 ? `?page=${p}` : ""}`;
  }

  return (
    <div className="animate-fade-slide-up flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`Histórico — ${stock.name}`}
        description={`CA ${stock.ca ?? "—"} · Saldo atual: ${stock.currentBalance} ${stock.unitOfMeasure ?? "un"}`}
        icon={<HistoryIcon />}
        action={
          <Link
            href={`/epi-stock/${id}/edit`}
            className="glass-panel hover-lift text-text-muted hover:text-text rounded-card px-4 py-2 text-sm font-semibold transition-all"
          >
            ← Voltar ao item
          </Link>
        }
      />

      {/* Card glass com tabela de movimentações */}
      <div
        className="glass-card animate-fade-in overflow-hidden"
        style={{ borderRadius: "20px" }}
      >
        {/* Cabeçalho da tabela */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr 1fr 1.2fr 1fr 1fr 1.5fr",
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
          <span>Data</span>
          <span>Tipo</span>
          <span>Quantidade</span>
          <span>Saldo Resultante</span>
          <span>Nº NF</span>
          <span>Lote</span>
          <span>Funcionário</span>
        </div>

        {/* Linhas ou empty state */}
        {rows.length === 0 ? (
          <EmptyState message="Nenhuma movimentação registrada para este item." />
        ) : (
          rows.map((row, idx) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.2fr 1fr 1.2fr 1fr 1fr 1.5fr",
                gap: "14px",
                padding: "15px 24px",
                alignItems: "center",
                fontSize: "13px",
                borderBottom: "1px solid rgba(120, 120, 150, 0.08)",
                background: idx % 2 === 1 ? "rgba(255, 255, 255, 0.2)" : "transparent",
              }}
            >
              {/* Data */}
              <span style={{ color: "#52576e" }}>{formatDate(row.movementDate)}</span>

              {/* Tipo */}
              <span style={{ fontWeight: 600 }}>{row.typeLabel}</span>

              {/* Quantidade com badge colorido */}
              <span>
                <MovementQtyBadge signedQty={row.signedQuantity} qty={row.quantity} />
              </span>

              {/* Saldo resultante em mono */}
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono, monospace)",
                  fontWeight: 700,
                  color: "#5b63f5",
                }}
              >
                {row.runningBalance}
              </span>

              {/* Nº NF (+ data da NF, quando informada) */}
              <span style={{ color: "#797e96" }}>
                {row.invoiceNumber ?? "—"}
                {row.invoiceDate ? ` (${formatDate(row.invoiceDate)})` : ""}
              </span>

              {/* Lote */}
              <span style={{ color: "#797e96" }}>{row.batch ?? "—"}</span>

              {/* Funcionário */}
              <span style={{ color: "#797e96" }}>{row.employeeName ?? "—"}</span>
            </div>
          ))
        )}

        {/* Paginação dentro do card */}
        {total > 0 && (
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
                    href={buildPageHref(clampedPage - 1)}
                    aria-label="Página anterior"
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "9px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "16px",
                      color: "#52576e",
                      textDecoration: "none",
                    }}
                  >
                    ‹
                  </Link>
                ) : (
                  <span
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "9px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "16px",
                      color: "#c3c6d4",
                    }}
                  >
                    ‹
                  </span>
                )}

                {pages.map((p) =>
                  p === clampedPage ? (
                    <span
                      key={p}
                      style={{
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
                      }}
                    >
                      {p}
                    </span>
                  ) : (
                    <Link
                      key={p}
                      href={buildPageHref(p)}
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "9px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#52576e",
                        fontSize: "13px",
                        textDecoration: "none",
                      }}
                    >
                      {p}
                    </Link>
                  ),
                )}

                {clampedPage < totalPages ? (
                  <Link
                    href={buildPageHref(clampedPage + 1)}
                    aria-label="Próxima página"
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "9px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "16px",
                      color: "#52576e",
                      textDecoration: "none",
                    }}
                  >
                    ›
                  </Link>
                ) : (
                  <span
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "9px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "16px",
                      color: "#c3c6d4",
                    }}
                  >
                    ›
                  </span>
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
        )}
      </div>
    </div>
  );
}
