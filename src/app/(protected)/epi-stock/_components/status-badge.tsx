import type { EpiStockStatus } from "@/shared/domains/pgr/epi-stock";

const STYLES: Record<EpiStockStatus, { label: string; className: string }> = {
  sem_saldo: {
    label: "Sem saldo",
    className:
      "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-900",
  },
  abaixo_minima: {
    label: "Abaixo da mínima",
    className:
      "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  },
  acima_minima: {
    label: "Acima da mínima",
    className:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  },
};

export function StockStatusBadge({ status }: { status: EpiStockStatus }) {
  const { label, className } = STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
