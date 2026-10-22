"use client";

import { useRef } from "react";

import { EXAM_TYPES, EXAM_TYPE_LABELS } from "@/shared/domains/pgr/health-exams";

/**
 * Busca (funcionário ou tipo de exame) + filtro de tipo na toolbar (GET). `display:
 * contents` deixa os filhos participarem do flex da `ListToolbar`. A busca envia
 * no Enter; tipo e empresa enviam ao mudar — sem botão, fiel ao mockup. O filtro de
 * funcionário (vindo da ficha) viaja como campo oculto. `companies === null` = as
 * opções não carregaram: o filtro de empresa some com um aviso curto (a lista segue).
 */
export function HealthExamFilters({
  basePath,
  search,
  examType,
  companies,
  companyId,
  employeeId,
}: {
  basePath: string;
  search?: string;
  examType?: string;
  companies: { id: string; razaoSocial: string }[] | null;
  companyId?: string;
  employeeId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={basePath} method="get" className="contents">
      {employeeId ? <input type="hidden" name="employeeId" value={employeeId} /> : null}
      <div className="focus-within:border-primary focus-within:ring-primary-ring flex h-11 min-w-0 flex-1 basis-[220px] items-center gap-2.5 rounded-xl border border-white/70 bg-white/50 px-4 focus-within:ring-[3px]">
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
          placeholder="Buscar por funcionário ou exame…"
          aria-label="Buscar por funcionário ou tipo de exame"
          className="text-text placeholder:text-text-subtle w-full bg-transparent text-[13px] outline-none"
        />
      </div>

      <span className="relative">
        <select
          name="examType"
          defaultValue={examType ?? ""}
          onChange={() => formRef.current?.submit()}
          aria-label="Filtrar por tipo de exame"
          className="text-text-muted focus-visible:border-primary focus-visible:ring-primary-ring h-11 cursor-pointer appearance-none rounded-xl border border-white/70 bg-white/50 pr-9 pl-4 text-[13px] font-semibold outline-none focus-visible:ring-[3px]"
        >
          <option value="">Todos os Tipos</option>
          {EXAM_TYPES.map((value) => (
            <option key={value} value={value}>
              {EXAM_TYPE_LABELS[value]}
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

      {companies === null ? (
        <span
          role="status"
          className="text-text-subtle self-center text-[12px] font-semibold"
        >
          Filtro de empresa indisponível
        </span>
      ) : (
        <span className="relative w-full max-w-full min-w-0 sm:w-auto sm:max-w-[320px]">
          <select
            name="companyId"
            defaultValue={companyId ?? ""}
            onChange={() => formRef.current?.submit()}
            aria-label="Filtrar por empresa"
            className="text-text-muted focus-visible:border-primary focus-visible:ring-primary-ring h-11 w-full cursor-pointer appearance-none truncate rounded-xl border border-white/70 bg-white/50 pr-9 pl-4 text-[13px] font-semibold outline-none focus-visible:ring-[3px]"
          >
            <option value="">Todas as Empresas</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razaoSocial}
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
      )}
    </form>
  );
}
