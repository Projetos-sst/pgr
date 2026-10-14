import Link from "next/link";

/**
 * Estado de erro de rota (401/403/404/500…). Presentational puro e sem
 * diretiva de cliente — serve tanto às páginas server (`forbidden`,
 * `unauthorized`, `not-found`) quanto ao boundary client (`error`), que passa
 * uma ação com `onClick` (retry). A ousadia visual fica só no código em mono;
 * o resto acompanha a identidade (barra de acento indigo + eyebrow mono).
 */
export type ErrorAction = {
  label: string;
  variant?: "primary" | "quiet";
} & ({ href: string } | { onClick: () => void });

export function ErrorState({
  code,
  eyebrow,
  title,
  description,
  actions = [],
  children,
}: {
  /** Código HTTP, quando existir um. Estados que não são erro de rota (ex.: a
      conta ainda sem organização) omitem — inventar um número seria mentira. */
  code?: string;
  eyebrow: string;
  title: string;
  description: string;
  actions?: ErrorAction[];
  /** Ação que precisa de cliente (ex.: sair da conta), ao lado das demais. */
  children?: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="glass-card rounded-glass w-full max-w-md p-8 sm:p-10">
        <div className="flex items-start gap-5">
          <span
            className={`bg-primary mt-1.5 w-1 shrink-0 rounded-full ${code ? "h-16" : "h-6"}`}
            aria-hidden
          />
          <div className="flex flex-col">
            <span className="text-text-subtle font-mono text-[11px] tracking-[0.18em] uppercase">
              {eyebrow}
            </span>
            {code ? (
              <span className="text-primary-strong mt-1 font-mono text-6xl font-bold tracking-tight tabular-nums sm:text-7xl">
                {code}
              </span>
            ) : null}
          </div>
        </div>

        <h1 className="text-text mt-8 text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="text-text-muted mt-2 text-sm leading-relaxed">{description}</p>

        {actions.length > 0 || children ? (
          <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center">
            {actions.map((action) => {
              const isQuiet = action.variant === "quiet";
              const className = isQuiet
                ? "text-text-muted hover:text-text inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold transition-colors"
                : "btn-primary rounded-pill inline-flex items-center justify-center px-5 py-2.5 text-sm font-bold transition-colors";

              return "href" in action ? (
                <Link key={action.label} href={action.href} className={className}>
                  {action.label}
                </Link>
              ) : (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={className}
                >
                  {action.label}
                </button>
              );
            })}
            {children}
          </div>
        ) : null}
      </div>
    </main>
  );
}
