"use client";

import { toolbarControlClass } from "./list";

/**
 * Select de filtro da toolbar de listagem. Mantém a aparência de "chip" do
 * mockup com uma seta desenhada — o `<select>` nativo continua por baixo,
 * preservando teclado e leitores de tela.
 *
 * Aplica o filtro no `change` porque a toolbar do redesign não tem botão
 * "Filtrar"; o `<form>` GET em volta continua sendo o mecanismo real, então a
 * navegação por teclado (Enter no campo de busca) funciona do mesmo jeito.
 */
export function ToolbarSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className={`${toolbarControlClass} text-text-muted relative font-semibold`}>
      <select
        name={name}
        aria-label={label}
        defaultValue={value ?? ""}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="h-full cursor-pointer appearance-none bg-transparent pr-5 outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="text-text-subtle pointer-events-none absolute right-4"
        aria-hidden
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
