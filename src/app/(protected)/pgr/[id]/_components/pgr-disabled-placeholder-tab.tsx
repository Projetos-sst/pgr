/**
 * Painel de aba desabilitada (Fase 05). GED, Cor/Sumário etc. não têm schema/storage nesta
 * fatia — aparecem como placeholder informativo, nunca como funcionalidade.
 */
export function PgrDisabledPlaceholderTab({ title }: { title: string }) {
  return (
    <section className="glass-card p-8 text-center">
      <h2 className="text-text text-lg font-semibold">{title}</h2>
      <p className="text-text-subtle mt-2 text-sm">
        Esta seção será implementada na <strong>Fase 05</strong> (Documentos e geração de
        PDF). Não faz parte desta entrega.
      </p>
    </section>
  );
}
