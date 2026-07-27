import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
  icon,
  backHref,
  backLabel = "Voltar",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3.5">
        {backHref ? (
          <Link
            href={backHref}
            aria-label={backLabel}
            className="glass-input rounded-field text-text-muted hover:text-text flex h-10 w-10 shrink-0 items-center justify-center transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
        ) : null}
        {icon ? (
          <div className="bg-primary shadow-primary flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[15px] text-white">
            {icon}
          </div>
        ) : null}
        <div>
          <h1 className="text-text text-xl font-extrabold tracking-[-0.02em] sm:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="text-text-subtle mt-0.5 text-xs sm:text-[13px]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="btn-primary hover-lift rounded-card shadow-primary flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all sm:text-sm"
    >
      {children}
    </Link>
  );
}

export function EmptyState({
  title = "Nenhum registro encontrado",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div className="glass-card animate-fade-slide-up flex flex-col items-center justify-center rounded-[20px] p-8 text-center sm:p-12">
      <div className="bg-primary/10 text-primary mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl shadow-xs">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      </div>
      <h3 className="text-text text-sm font-bold sm:text-base">{title}</h3>
      <p className="text-text-subtle mt-1 max-w-md text-xs sm:text-sm">{message}</p>
    </div>
  );
}

/**
 * Card único que envolve barra de filtros + tabela + paginação (padrão das telas
 * de listagem dos mockups do redesign). `overflow-hidden` faz as bordas internas
 * respeitarem o raio do card.
 */
export function ListCard({ children }: { children: ReactNode }) {
  return (
    <div className="glass-card animate-fade-in overflow-hidden rounded-[20px]">
      {children}
    </div>
  );
}

const LIST_TOOLBAR_CLASS =
  "flex flex-col gap-3 border-b border-black/10 p-4 sm:flex-row sm:items-center sm:gap-3.5 sm:px-5 sm:py-[18px]";

/**
 * Faixa de filtros/ações no topo do `ListCard`. Com `action`, a própria faixa é
 * o `<form>` GET dos filtros — assim busca e selects compartilham um submit só,
 * sem `display: contents` (que apaga a semântica de formulário em alguns AT).
 */
export function ListToolbar({
  action,
  children,
}: {
  action?: string;
  children: ReactNode;
}) {
  if (!action) return <div className={LIST_TOOLBAR_CLASS}>{children}</div>;
  return (
    <form action={action} method="get" className={LIST_TOOLBAR_CLASS}>
      {children}
    </form>
  );
}

const TOOLBAR_CONTROL_CLASS =
  "glass-input rounded-card flex h-11 items-center gap-2 px-4 text-[13px]";

/** Campo de busca da toolbar, com ícone de lupa embutido (submete no Enter). */
export function ToolbarSearch({
  name = "search",
  placeholder,
  defaultValue,
  label,
}: {
  name?: string;
  placeholder: string;
  defaultValue?: string;
  label: string;
}) {
  return (
    <div className={`${TOOLBAR_CONTROL_CLASS} flex-1`}>
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        className="text-text-subtle shrink-0"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4-4" />
      </svg>
      <input
        type="search"
        name={name}
        aria-label={label}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="text-text placeholder:text-text-subtle h-full w-full min-w-0 bg-transparent outline-none"
      />
    </div>
  );
}

/** Classe compartilhada com o `ToolbarSelect` (client component). */
export const toolbarControlClass = TOOLBAR_CONTROL_CLASS;

/** Botão primário com a mesma altura dos demais controles da toolbar. */
export function ToolbarPrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="btn-primary hover-lift rounded-card shadow-primary flex h-11 shrink-0 items-center justify-center gap-2 px-[18px] text-[13px] font-bold transition-all"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      {children}
    </Link>
  );
}

export type StatusTone = "primary" | "amber" | "green" | "danger" | "neutral";

const STATUS_TONE_CLASS: Record<StatusTone, { pill: string; dot: string }> = {
  primary: { pill: "bg-primary/12 text-primary", dot: "bg-primary" },
  amber: {
    pill: "bg-accent-amber/16 text-accent-amber-strong",
    dot: "bg-accent-amber-strong",
  },
  green: { pill: "bg-accent-green/14 text-accent-green", dot: "bg-accent-green" },
  danger: { pill: "bg-danger/12 text-danger", dot: "bg-danger" },
  neutral: { pill: "bg-text-subtle/14 text-text-muted", dot: "bg-text-subtle" },
};

/** Etiqueta de status com ponto colorido (padrão das tabelas do redesign). */
export function StatusPill({
  tone,
  children,
}: {
  tone: StatusTone;
  children: ReactNode;
}) {
  const { pill, dot } = STATUS_TONE_CLASS[tone];
  return (
    <span
      className={`rounded-pill inline-flex w-fit items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold ${pill}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
      {children}
    </span>
  );
}

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

export function SearchForm({
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
    <form action={basePath} method="get" className="flex gap-2">
      {hidden
        ? Object.entries(hidden)
            .filter(([, v]) => v !== undefined && v !== "")
            .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
        : null}
      <div className="relative max-w-xs flex-1">
        <input
          name="search"
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
          className="glass-input text-text placeholder:text-text-subtle rounded-card w-full px-3.5 py-2 text-sm outline-none"
        />
      </div>
      <button
        type="submit"
        className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
      >
        Buscar
      </button>
    </form>
  );
}

export function Pagination({
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
  if (total === 0) return null;

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
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <nav className="text-text-subtle flex flex-wrap items-center justify-between gap-4 border-t border-black/5 px-6 py-4 text-xs sm:text-sm">
      <span>
        Mostrando <strong className="text-text font-semibold">{startItem}</strong> a{" "}
        <strong className="text-text font-semibold">{endItem}</strong> de{" "}
        <strong className="text-text font-semibold">{total}</strong> registros
      </span>

      {totalPages > 1 ? (
        <div className="flex items-center gap-1.5">
          {clampedPage > 1 ? (
            <Link
              href={`${basePath}${buildQuery(params, { page: String(clampedPage - 1) })}`}
              className="rounded-card glass-panel text-text-muted hover:text-text flex h-8 w-8 items-center justify-center transition-colors"
              aria-label="Página anterior"
            >
              ‹
            </Link>
          ) : (
            <span className="rounded-card text-text-subtle/50 flex h-8 w-8 cursor-not-allowed items-center justify-center">
              ‹
            </span>
          )}

          {pages.map((p) =>
            p === clampedPage ? (
              <span
                key={p}
                className="rounded-card bg-primary shadow-primary flex h-8 w-8 items-center justify-center text-xs font-bold text-white"
              >
                {p}
              </span>
            ) : (
              <Link
                key={p}
                href={`${basePath}${buildQuery(params, { page: String(p) })}`}
                className="rounded-card glass-panel text-text-muted hover:text-text flex h-8 w-8 items-center justify-center text-xs font-medium transition-colors"
              >
                {p}
              </Link>
            ),
          )}

          {clampedPage < totalPages ? (
            <Link
              href={`${basePath}${buildQuery(params, { page: String(clampedPage + 1) })}`}
              className="rounded-card glass-panel text-text-muted hover:text-text flex h-8 w-8 items-center justify-center transition-colors"
              aria-label="Próxima página"
            >
              ›
            </Link>
          ) : (
            <span className="rounded-card text-text-subtle/50 flex h-8 w-8 cursor-not-allowed items-center justify-center">
              ›
            </span>
          )}
        </div>
      ) : null}

      <div className="text-text-subtle flex items-center gap-2 text-xs">
        Itens por página:
        <span className="rounded-card glass-panel text-text flex h-8 items-center justify-center px-3 font-semibold">
          {pageSize}
        </span>
      </div>
    </nav>
  );
}

export function Table({
  headers,
  embedded = false,
  children,
}: {
  headers: string[];
  /**
   * Quando a tabela já vive dentro de um `ListCard`, o card externo é quem
   * desenha o vidro/raio/sombra — repetir aqui criaria uma borda dupla.
   */
  embedded?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={
        embedded
          ? "overflow-x-auto"
          : "glass-card animate-fade-in overflow-x-auto rounded-[20px]"
      }
    >
      <table className="w-full border-collapse text-xs sm:text-[13px]">
        <thead className="text-text-subtle border-b border-black/5 bg-transparent font-mono text-[10px] tracking-widest uppercase">
          <tr>
            {headers.map((h, idx) => (
              <th
                key={h}
                className={`px-4 py-3.5 font-medium sm:px-6 ${
                  idx === headers.length - 1 ? "text-right" : "text-left"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        {/* `:not(:hover)` na faixa zebrada para o hover vencer sem depender da
            ordem em que o Tailwind emite as duas regras (mesma especificidade). */}
        <tbody className="divide-y divide-black/5 [&_tr]:transition-colors [&_tr]:duration-200 [&_tr:hover]:bg-white/40 [&_tr:nth-child(even):not(:hover)]:bg-white/20">
          {children}
        </tbody>
      </table>
    </div>
  );
}
