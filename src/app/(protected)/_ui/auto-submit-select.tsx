"use client";

/**
 * Select de filtro que envia o formulário ao mudar — o redesign não prevê botão
 * "filtrar" ao lado do campo. Sem JS o `<select>` continua funcional: o
 * formulário ainda é submetido pelo Enter no campo de busca.
 */
export function AutoSubmitSelect({
  id,
  name,
  defaultValue,
  options,
  emptyLabel,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  emptyLabel: string;
}) {
  return (
    <span className="relative">
      <select
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="glass-input text-text-muted rounded-card h-11 appearance-none pr-9 pl-4 text-[13px] font-semibold outline-none"
      >
        <option value="">{emptyLabel}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="text-text-subtle pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[11px]"
      >
        ▾
      </span>
    </span>
  );
}
