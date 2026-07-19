import type { DocumentKpis } from "@/shared/domains/documents/kpis";

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-card flex flex-col px-4 py-3">
      <span className="text-text-subtle text-xs tracking-wide uppercase">{label}</span>
      <span className="text-text text-2xl font-semibold">{value}</span>
    </div>
  );
}

export function DocumentKpisRow({ kpis }: { kpis: DocumentKpis }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <KpiCard label="Documentos" value={kpis.documents} />
      <KpiCard label="Pastas" value={kpis.folders} />
      <KpiCard label="A vencer (30 dias)" value={kpis.dueSoon} />
      <KpiCard label="Vencidos" value={kpis.expired} />
    </div>
  );
}
