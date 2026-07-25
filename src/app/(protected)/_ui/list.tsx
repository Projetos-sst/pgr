import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-4">
        {icon ? (
          <div className="bg-primary shadow-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] text-white">
            {icon}
          </div>
        ) : null}
        <div>
          <h1 className="text-text text-xl font-extrabold tracking-tight sm:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="text-text-subtle mt-0.5 text-xs sm:text-sm">{description}</p>
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
      className="btn-primary rounded-card shadow-primary flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all sm:text-sm"
    >
      {children}
    </Link>
  );
}

export function EmptyState({
  title = "Nenhum documento encontrado",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center sm:p-14">
      <div className="bg-primary/10 text-primary mb-3 flex h-12 w-12 items-center justify-center rounded-2xl shadow-xs">
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
      <p className="text-text-subtle mt-1 max-w-sm text-xs sm:text-sm">{message}</p>
    </div>
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

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(total, page * pageSize);

  const pages: number[] = [];
  const maxDisplayed = 5;
  let startPage = Math.max(1, page - Math.floor(maxDisplayed / 2));
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
          {page > 1 ? (
            <Link
              href={`${basePath}${buildQuery(params, { page: String(page - 1) })}`}
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
            p === page ? (
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

          {page < totalPages ? (
            <Link
              href={`${basePath}${buildQuery(params, { page: String(page + 1) })}`}
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

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="glass-card overflow-x-auto rounded-[20px]">
      <table className="w-full border-collapse text-xs sm:text-sm">
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
        <tbody className="divide-y divide-black/5">{children}</tbody>
      </table>
    </div>
  );
}
