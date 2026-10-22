"use client";

import { AutoSubmitSelect } from "../../_ui/auto-submit-select";

/**
 * Empresa + busca do painel (GET em `/medicine`). A empresa envia ao mudar
 * (`AutoSubmitSelect`); a busca, no Enter. `display: contents` deixa os filhos
 * participarem do flex-wrap da `ListToolbar` (empilham no mobile). Trocar a
 * empresa volta à página 1 (sem `page` no formulário). A empresa aqui é só
 * filtro — o servidor revalida que ela é do tenant e tem Medicina.
 */
export function MedicineCompanyFilter({
  companies,
  companyId,
  search,
}: {
  companies: { id: string; name: string }[];
  companyId?: string;
  search?: string;
}) {
  return (
    <form action="/medicine" method="get" className="contents">
      <span className="flex w-full max-w-full min-w-0 sm:w-auto sm:max-w-[320px] [&_select]:w-full [&_select]:truncate [&>span]:w-full">
        <label htmlFor="medicine-company" className="sr-only">
          Empresa
        </label>
        <AutoSubmitSelect
          id="medicine-company"
          name="companyId"
          defaultValue={companyId}
          options={companies.map((c) => ({ value: c.id, label: c.name }))}
          emptyLabel="Selecione uma empresa"
        />
      </span>

      <div className="focus-within:border-primary focus-within:ring-primary-ring flex h-11 min-w-0 flex-1 basis-[220px] items-center gap-2.5 rounded-xl border border-white/70 bg-white/50 px-4 focus-within:ring-[3px]">
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          aria-hidden="true"
          className="text-text-subtle shrink-0"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" />
        </svg>
        <input
          type="search"
          name="search"
          defaultValue={search ?? ""}
          placeholder="Buscar por funcionário, função ou GES…"
          aria-label="Buscar funcionário por nome, função ou GES"
          className="text-text placeholder:text-text-subtle w-full min-w-0 bg-transparent text-[13px] outline-none"
        />
      </div>
    </form>
  );
}
