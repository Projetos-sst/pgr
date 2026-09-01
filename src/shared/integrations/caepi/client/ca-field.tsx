"use client";

import { useCaepiValidation, type CaFound } from "./use-caepi-validation";
import type { CaepiValidationStatus } from "./use-caepi-validation";

// Tokens do design system (espelha o `fieldClass` de `_ui/form.tsx`) — antes usava
// `rounded-md border-black/15`, fora do padrão glass/indigo do PGR (#201).
const inputClass =
  "glass-input text-text placeholder:text-text-subtle rounded-field h-[46px] w-full px-3.5 text-[13px] font-mono outline-none";

/**
 * Campo de CA plugável no formulário de EPI (#18): lookup no blur contra o
 * espelho local do CAEPI, feedback por estado e autofill via `onFound` (o pai
 * escreve fabricante/norma/validade no SEU formulário — cópia por valor).
 * O campo é sempre editável e nenhum estado bloqueia o salvamento (FR-062/063):
 * `expired` ainda autopreenche; `error` é silencioso.
 */
export function CaField({
  value,
  onChange,
  onFound,
  onNotFound,
  name = "ca",
  label = "CA (Certificado de Aprovação)",
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  onFound: (data: CaFound) => void;
  onNotFound?: () => void;
  name?: string;
  label?: string;
  error?: string;
}) {
  const caepi = useCaepiValidation(onFound, onNotFound);

  return (
    <label className="block">
      <span className="text-text-muted mb-1.5 block text-xs font-semibold">{label}</span>
      <input
        name={name}
        type="text"
        inputMode="numeric"
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => caepi.lookup(value)}
      />
      <span className="mt-1 block">
        <CaStatus
          status={caepi.status}
          baseUnsynced={caepi.data?.status === "not_found" && caepi.data.baseUnsynced}
        />
      </span>
      {error ? <p className="text-danger mt-1 text-xs">{error}</p> : null}
    </label>
  );
}

function CaStatus({
  status,
  baseUnsynced,
}: {
  status: CaepiValidationStatus;
  baseUnsynced?: boolean;
}) {
  if (status === "loading") {
    return (
      <span className="text-xs text-black/50 dark:text-white/50">Consultando CA…</span>
    );
  }
  if (status === "valid") {
    return (
      <span className="w-fit rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
        CA válido
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="text-xs text-amber-600 dark:text-amber-400">
        CA vencido — confira antes de usar. Dados preenchidos para conferência.
      </span>
    );
  }
  if (status === "not_found") {
    return (
      <span className="text-xs text-amber-600 dark:text-amber-400">
        {baseUnsynced
          ? "Base CAEPI ainda não sincronizada. Preencha manualmente."
          : "CA não encontrado na base CAEPI. Preencha manualmente."}
      </span>
    );
  }
  if (status === "invalid") {
    return (
      <span className="text-xs text-amber-600 dark:text-amber-400">
        CA inválido — use apenas números.
      </span>
    );
  }
  return null;
}
