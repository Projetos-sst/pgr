/**
 * Painel de aba desabilitada (Fase 05). GED, Cor/Sumário etc. não têm schema/storage nesta
 * fatia — aparecem como placeholder informativo, nunca como funcionalidade.
 */
export function PgrDisabledPlaceholderTab({ title }: { title: string }) {
  return (
    <section className="rounded-lg border border-dashed border-black/15 p-8 text-center dark:border-white/15">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Esta seção será implementada na <strong>Fase 05</strong> (Documentos e geração de
        PDF). Não faz parte desta entrega.
      </p>
    </section>
  );
}
