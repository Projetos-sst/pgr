/**
 * Falha de leitura de uma seção dentro de uma página que carregou. Erro ≠ vazio: diz que a leitura
 * falhou (nunca "nenhum registro") e oferece "Tentar novamente" para a mesma URL; um `<a>` comum
 * força nova requisição ao servidor. Para a página ou lista inteira, use `ListErrorState`.
 */
export function SectionLoadError({
  what,
  retryHref,
}: {
  what: string;
  retryHref: string;
}) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"
    >
      Não foi possível carregar {what}. Isso não significa que não haja registros.{" "}
      <a href={retryHref} className="font-semibold underline">
        Tentar novamente
      </a>
    </p>
  );
}
