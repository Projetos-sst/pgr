import type { CompanyModule } from "@/shared/domains/platform/company-modules";

/**
 * Indicadores de serviço por empresa (NOB-171): estado sempre com texto e ícone, nunca só cor.
 * Mesma fonte de verdade na listagem e em Gerenciar serviços (`company_modules`, NOB-170).
 */
const SHORT: Record<CompanyModule, { on: string; off: string }> = {
  pgr: { on: "PGR ativo", off: "PGR desabilitado" },
  medicine: { on: "Medicina ativa", off: "Medicina desabilitada" },
};

export function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function CrossIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

const onClass =
  "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200";
const offClass =
  "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200";

/** Status em destaque do cartão de serviço. */
export function ServiceStatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${enabled ? onClass : offClass}`}
    >
      {enabled ? <CheckIcon size={14} /> : <CrossIcon size={14} />}
      {enabled ? "Habilitado" : "Desabilitado"}
    </span>
  );
}

/** Forma compacta da listagem: "PGR ativo", "Medicina desabilitada"… */
export function ServiceTag({
  module,
  enabled,
}: {
  module: CompanyModule;
  enabled: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${enabled ? onClass : offClass}`}
    >
      {enabled ? <CheckIcon /> : <CrossIcon />}
      {enabled ? SHORT[module].on : SHORT[module].off}
    </span>
  );
}

/** Resumo da listagem: as duas etiquetas, ou "Nenhum serviço habilitado". */
export function CompanyServicesSummary({
  pgrEnabled,
  medicineEnabled,
}: {
  pgrEnabled: boolean;
  medicineEnabled: boolean;
}) {
  if (!pgrEnabled && !medicineEnabled)
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${offClass}`}
      >
        <CrossIcon />
        Nenhum serviço habilitado
      </span>
    );
  return (
    <span className="flex flex-wrap gap-1">
      <ServiceTag module="pgr" enabled={pgrEnabled} />
      <ServiceTag module="medicine" enabled={medicineEnabled} />
    </span>
  );
}
