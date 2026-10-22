/**
 * Falha de leitura dentro de uma página (lista, painel, seção). Erro ≠ vazio: diz
 * que a leitura falhou — nunca "nenhum registro" — e oferece "Tentar novamente"
 * para a mesma URL. Mesma identidade do `ErrorState` de rota (barra de acento
 * indigo + eyebrow mono), mas embutível: `<section role="alert">` + `<h2>`, sem
 * `<main>`/`<h1>` (a página já tem os seus).
 */
export function ListErrorState({
  title,
  description,
  code,
  retryHref,
  isFlat,
}: {
  title: string;
  description: string;
  /** Código de erro do contrato (`FORBIDDEN`, `VALIDATION`…), exibido em mono. */
  code?: string;
  /** Mesma URL da página; um `<a>` comum força uma nova requisição ao servidor. */
  retryHref?: string;
  /** Sem a moldura glass — para uso dentro de um `ListCard`/seção. */
  isFlat?: boolean;
}) {
  return (
    <section
      role="alert"
      className={`animate-fade-in p-6 sm:p-8 ${isFlat ? "" : "glass-card rounded-[20px]"}`}
    >
      <div className="flex items-start gap-4">
        <span className="bg-primary mt-1 h-6 w-1 shrink-0 rounded-full" aria-hidden />
        <div className="flex min-w-0 flex-col">
          <span className="text-text-subtle font-mono text-[11px] tracking-[0.18em] break-words uppercase">
            Falha na leitura{code ? ` · ${code}` : ""}
          </span>
          <h2 className="text-text mt-1.5 text-base font-extrabold tracking-tight sm:text-lg">
            {title}
          </h2>
          <p className="text-text-muted mt-1 max-w-xl text-sm leading-relaxed">
            {description}
          </p>
          {retryHref ? (
            <a
              href={retryHref}
              className="btn-primary rounded-pill mt-4 inline-flex h-11 w-fit items-center justify-center px-5 text-sm font-bold transition-colors"
            >
              Tentar novamente
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Monta `basePath?a=1&b=2` ignorando valores vazios — URL de "Tentar novamente". */
export function hrefWithParams(
  basePath: string,
  params: Record<string, string | undefined>,
): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") usp.set(key, value);
  }
  const qs = usp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
