import type { DocumentKpis } from "@/shared/domains/documents/kpis";

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-card hover-lift flex flex-col justify-between p-4 transition-all">
      <span className="text-text-subtle font-mono text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </span>
      <span className="text-text mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
        {value}
      </span>
    </div>
  );
}

export function DocumentKpisRow({ kpis }: { kpis: DocumentKpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      <KpiCard label="Documentos" value={kpis.documents} />
      <KpiCard label="Pastas" value={kpis.folders} />
      <KpiCard label="A vencer (30d)" value={kpis.dueSoon} />
      <KpiCard label="Vencidos" value={kpis.expired} />
    </div>
  );
}
