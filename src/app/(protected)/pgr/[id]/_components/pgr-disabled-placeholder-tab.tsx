/**
 * Painel de aba desabilitada (Fase 05). GED, Cor/Sumário etc.
 */
export function PgrDisabledPlaceholderTab({ title }: { title: string }) {
  return (
    <section className="glass-card flex flex-col items-center justify-center p-12 text-center">
      <div className="bg-primary/10 text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      </div>
      <h2 className="text-text text-base font-bold sm:text-lg">{title}</h2>
      <p className="text-text-subtle mt-1.5 max-w-md text-xs sm:text-sm">
        Esta funcionalidade será disponibilizada na <strong>Fase 05</strong> (Gestão de
        Documentos e geração de PDF customizada).
      </p>
    </section>
  );
}
