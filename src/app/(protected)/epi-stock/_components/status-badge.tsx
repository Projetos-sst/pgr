import type { EpiStockStatus } from "@/shared/domains/pgr/epi-stock";

const STYLES: Record<EpiStockStatus, { label: string; className: string }> = {
  sem_saldo: {
    label: "Sem saldo",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  abaixo_minima: {
    label: "Abaixo da mínima",
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  acima_minima: {
    label: "Acima da mínima",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
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
