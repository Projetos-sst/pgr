/**
 * "Dica" de preenchimento — texto de orientação (estático) exibido sob os
 * campos críticos dos formulários (GES, risco). Presentational puro; o conteúdo
 * vem de `@/shared/domains/pgr/field-hints`.
 */
export function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-text-subtle mt-1 text-xs">
      <span className="text-primary-strong font-semibold">Dica:</span> {children}
    </p>
  );
}
