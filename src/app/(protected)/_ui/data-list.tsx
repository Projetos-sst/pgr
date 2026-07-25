import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/*
 * Kit de lista do redesign — replica o padrão visual dos mockups `*.dc.html`
 * (card glass + toolbar integrada + linhas em grid + footer com paginação
 * numerada). Componentes puramente apresentacionais (server-friendly); cada
 * tela compõe suas colunas/linhas. Cores/raios seguem os tokens do globals.css.
 */

// ── Card + toolbar ──────────────────────────────────────────────────────────

export function ListCard({ children }: { children: ReactNode }) {
  return <div className="glass-card overflow-hidden rounded-[20px]">{children}</div>;
}

export function ListToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3.5 border-b border-[rgba(120,120,150,0.1)] p-[18px_20px]">
      {children}
    </div>
  );
}

function SearchIcon() {
  return (
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
  );
}

/** Busca (GET) integrada à toolbar — cresce para ocupar o espaço disponível. */
export function ToolbarSearch({
  basePath,
  placeholder,
  defaultValue,
  hidden,
}: {
  basePath: string;
  placeholder: string;
  defaultValue?: string;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form
      action={basePath}
      method="get"
      className="focus-within:border-primary focus-within:ring-primary-ring flex h-11 min-w-[220px] flex-1 items-center gap-2.5 rounded-xl border border-white/70 bg-white/50 px-4 focus-within:ring-[3px]"
    >
      {hidden
        ? Object.entries(hidden)
            .filter(([, v]) => v !== undefined && v !== "")
            .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
        : null}
      <SearchIcon />
      <input
        name="search"
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="text-text placeholder:text-text-subtle w-full bg-transparent text-[13px] outline-none"
      />
    </form>
  );
}

/** Pill de filtro visual (ex.: "Todas as Empresas ▾"). */
export function ToolbarFilterPill({ children }: { children: ReactNode }) {
  return (
    <div className="text-text-muted flex h-11 items-center gap-2 rounded-xl border border-white/70 bg-white/50 px-4 text-[13px] font-semibold">
      {children}
    </div>
  );
}

/** Botão primário da toolbar (ex.: "Novo Veículo"). */
export function ToolbarButton({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="btn-primary flex h-11 items-center gap-2 rounded-xl px-[18px] text-[13px] font-bold transition-colors"
    >
      {icon ?? <PlusIcon />}
      {children}
    </Link>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

// ── Grid (cabeçalho + linhas) ───────────────────────────────────────────────

export type GridColumn = { header: string; align?: "left" | "right" };

function gridStyle(template: string): CSSProperties {
  return { gridTemplateColumns: template };
}

/** Envolve cabeçalho + linhas com scroll horizontal (evita esmagar colunas no
 *  mobile). Toolbar e footer ficam fora, sem rolar. */
export function DataGrid({
  minWidth = 880,
  children,
}: {
  minWidth?: number;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <div role="table" style={{ minWidth }}>
        {children}
      </div>
    </div>
  );
}

export function GridHeader({
  template,
  columns,
}: {
  template: string;
  columns: GridColumn[];
}) {
  return (
    <div
      role="row"
      style={gridStyle(template)}
      className="text-text-subtle grid items-center gap-4 border-b border-[rgba(120,120,150,0.12)] px-6 py-3.5 font-mono text-[10px] tracking-[0.1em] uppercase"
    >
      {columns.map((c, i) => (
        <span
          key={i}
          role="columnheader"
          className={c.align === "right" ? "text-right" : undefined}
        >
          {c.header}
        </span>
      ))}
    </div>
  );
}

export function GridRow({
  template,
  striped,
  children,
}: {
  template: string;
  striped?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role="row"
      style={gridStyle(template)}
      className={`grid items-center gap-4 border-b border-[rgba(120,120,150,0.08)] px-6 py-[15px] text-[13px] last:border-b-0 ${
        striped ? "bg-white/20" : ""
      }`}
    >
      {children}
    </div>
  );
}

export function Cell({
  children,
  align,
  className,
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <span
      role="cell"
      className={`${align === "right" ? "text-right" : ""} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

/** Placa/código em fonte mono indigo, opcionalmente com link. */
export function MonoCell({ href, children }: { href?: string; children: ReactNode }) {
  const cls = "text-primary font-mono font-semibold";
  return (
    <span role="cell">
      {href ? (
        <Link href={href} className={`${cls} hover:underline`}>
          {children}
        </Link>
      ) : (
        <span className={cls}>{children}</span>
      )}
    </span>
  );
}

/** Avatar quadrado com iniciais (ex.: nome de empresa/funcionário). */
export function AvatarBadge({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className="text-primary flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[rgba(91,99,245,0.12)] text-[13px] font-extrabold"
    >
      {initials}
    </span>
  );
}

// ── Badge de status (pill com bolinha) ──────────────────────────────────────

export type StatusTone = "green" | "amber" | "red" | "neutral" | "indigo";

const TONE: Record<StatusTone, { bg: string; fg: string; dot: string }> = {
  green: { bg: "rgba(16,185,129,0.14)", fg: "#0e9f6e", dot: "#0e9f6e" },
  amber: { bg: "rgba(245,165,36,0.16)", fg: "#c9820a", dot: "#c9820a" },
  red: { bg: "rgba(229,72,77,0.14)", fg: "#d33a3f", dot: "#d33a3f" },
  neutral: { bg: "rgba(120,120,150,0.12)", fg: "#8c91a8", dot: "#8c91a8" },
  indigo: { bg: "rgba(91,99,245,0.12)", fg: "#5b63f5", dot: "#5b63f5" },
};

export function StatusBadge({
  tone,
  children,
}: {
  tone: StatusTone;
  children: ReactNode;
}) {
  const c = TONE[tone];
  return (
    <span
      className="inline-flex w-fit items-center gap-1.5 rounded-[20px] px-[11px] py-1 text-[11px] font-bold"
      style={{ background: c.bg, color: c.fg }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: c.dot }}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

// ── Footer (contagem + paginação numerada) ──────────────────────────────────

function buildQuery(
  params: Record<string, string | undefined>,
  overrides: Record<string, string>,
): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...overrides })) {
    if (value !== undefined && value !== "") usp.set(key, value);
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

/** Janela de páginas ao redor da atual (máx. 5 números visíveis). */
function pageWindow(page: number, totalPages: number): number[] {
  const span = 5;
  let start = Math.max(1, page - Math.floor(span / 2));
  const end = Math.min(totalPages, start + span - 1);
  start = Math.max(1, end - span + 1);
  const out: number[] = [];
  for (let p = start; p <= end; p++) out.push(p);
  return out;
}

export function ListFooter({
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
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages = pageWindow(page, totalPages);

  const pageHref = (p: number) => `${basePath}${buildQuery(params, { page: String(p) })}`;
  const numBase =
    "flex h-8 w-8 items-center justify-center rounded-[9px] text-[13px] transition-colors";

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[rgba(120,120,150,0.12)] px-6 py-4">
      <span className="text-text-subtle text-xs">
        Mostrando <strong className="text-text-muted">{from}</strong> a{" "}
        <strong className="text-text-muted">{to}</strong> de{" "}
        <strong className="text-text-muted">{total}</strong> registro(s)
      </span>

      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link
            href={pageHref(page - 1)}
            aria-label="Página anterior"
            className={`${numBase} text-text-muted hover:bg-white/50`}
          >
            ‹
          </Link>
        ) : (
          <span className={`${numBase} text-[#c3c6d4]`}>‹</span>
        )}

        {pages.map((p) =>
          p === page ? (
            <span
              key={p}
              aria-current="page"
              className={`${numBase} btn-primary font-bold`}
            >
              {p}
            </span>
          ) : (
            <Link
              key={p}
              href={pageHref(p)}
              className={`${numBase} text-text-muted hover:bg-white/50`}
            >
              {p}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link
            href={pageHref(page + 1)}
            aria-label="Próxima página"
            className={`${numBase} text-text-muted hover:bg-white/50`}
          >
            ›
          </Link>
        ) : (
          <span className={`${numBase} text-[#c3c6d4]`}>›</span>
        )}
      </div>

      <div className="text-text-subtle flex items-center gap-2 text-xs">
        Itens por página:
        <span className="text-text-muted flex h-8 items-center rounded-[9px] border border-white/70 bg-white/50 px-3 font-semibold">
          {pageSize}
        </span>
      </div>
    </div>
  );
}

// ── Ações de linha ──────────────────────────────────────────────────────────

/** Container das ações da linha (alinhado à direita). */
export function RowActions({ children }: { children: ReactNode }) {
  return <span className="flex items-center justify-end gap-1">{children}</span>;
}

/** Link de ver/editar (ícone olho indigo). */
export function EditIconLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Ver/editar"
      title="Ver/editar"
      className="text-primary flex h-8 w-8 items-center justify-center rounded-[9px] transition-colors hover:bg-white/50"
    >
      <ViewIcon />
    </Link>
  );
}

// ── Ícone de ação (olho) ────────────────────────────────────────────────────

export function ViewIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}
