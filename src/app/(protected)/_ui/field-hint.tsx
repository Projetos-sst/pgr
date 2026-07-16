/**
 * "Dica de Preenchimento da IA" — texto de orientação (estático) exibido sob os
 * campos críticos dos formulários (GES, risco). Presentational puro; o conteúdo
 * vem de `@/shared/domains/pgr/field-hints`.
 */
export function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-text-subtle mt-1 flex gap-1.5 text-xs">
      <span aria-hidden className="select-none">
        💡
      </span>
      <span>
        <span className="text-primary-strong font-semibold">Dica da IA:</span> {children}
      </span>
    </p>
  );
}
