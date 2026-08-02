"use client";

import { useRef } from "react";

/**
 * Busca + filtro de status na toolbar (GET). `display: contents` no form deixa
 * os filhos participarem do flex da `ListToolbar`. A busca envia no Enter; o
 * status envia ao mudar — sem botão extra, fiel ao mockup.
 */
export function MedicoFilters({
  basePath,
  search,
  status,
}: {
  basePath: string;
  search?: string;
  status?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={basePath} method="get" className="contents">
      <div className="focus-within:border-primary focus-within:ring-primary-ring flex h-11 min-w-[220px] flex-1 items-center gap-2.5 rounded-xl border border-white/70 bg-white/50 px-4 focus-within:ring-[3px]">
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9095ad"
          strokeWidth="1.9"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" />
        </svg>
        <input
          name="search"
          defaultValue={search ?? ""}
          placeholder="Buscar por nome ou CRM…"
          aria-label="Buscar por nome ou CRM"
          className="text-text placeholder:text-text-subtle w-full bg-transparent text-[13px] outline-none"
        />
      </div>

      <span className="relative">
        <select
          name="status"
          defaultValue={status ?? ""}
          onChange={() => formRef.current?.submit()}
          aria-label="Filtrar por status"
          className="text-text-muted h-11 cursor-pointer appearance-none rounded-xl border border-white/70 bg-white/50 pr-9 pl-4 text-[13px] font-semibold outline-none"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
        <span
          aria-hidden
          className="text-text-subtle pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[11px]"
        >
          ▾
        </span>
      </span>
    </form>
  );
}
