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
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
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
      className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 dark:bg-white dark:text-black"
    >
      {children}
    </Link>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-black/15 px-6 py-12 text-center text-sm text-zinc-500 dark:border-white/15">
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
        className="w-full max-w-xs rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-zinc-900"
      />
      <button
        type="submit"
        className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15"
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
      <span className="text-zinc-500">
        Página {page} de {totalPages} · {total} registro(s)
      </span>
      <div className="flex gap-2">
        {hasPrev ? (
          <Link
            href={`${basePath}${buildQuery(params, { page: String(page - 1) })}`}
            className="rounded-md border border-black/15 px-3 py-1 transition-colors hover:bg-black/5 dark:border-white/15"
          >
            Anterior
          </Link>
        ) : null}
        {hasNext ? (
          <Link
            href={`${basePath}${buildQuery(params, { page: String(page + 1) })}`}
            className="rounded-md border border-black/15 px-3 py-1 transition-colors hover:bg-black/5 dark:border-white/15"
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
    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-black/3 text-left dark:bg-white/5">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2 font-medium">
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
