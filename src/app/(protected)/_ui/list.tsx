import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-text text-2xl font-extrabold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-text-muted mt-1 text-sm">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="btn-primary rounded-pill px-4 py-2 text-sm font-semibold transition-colors"
    >
      {children}
    </Link>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="glass-card text-text-subtle px-6 py-12 text-center text-sm">
      {message}
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
      <input
        name="search"
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="glass-input text-text placeholder:text-text-subtle rounded-card w-full max-w-xs px-3 py-2 text-sm"
      />
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
  if (totalPages <= 1) return null;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  return (
    <nav className="flex items-center justify-between gap-4 text-sm">
      <span className="text-text-subtle">
        Página {page} de {totalPages} · {total} registro(s)
      </span>
      <div className="flex gap-2">
        {hasPrev ? (
          <Link
            href={`${basePath}${buildQuery(params, { page: String(page - 1) })}`}
            className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 transition-colors"
          >
            Anterior
          </Link>
        ) : null}
        {hasNext ? (
          <Link
            href={`${basePath}${buildQuery(params, { page: String(page + 1) })}`}
            className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 transition-colors"
          >
            Próxima
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="glass-card overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="text-text-muted border-b border-white/50 text-left">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
