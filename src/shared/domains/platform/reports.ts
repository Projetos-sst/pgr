import type { DashboardSummary } from "./dashboard";

export type ReportType = {
  key: string;
  title: string;
  description: string;
  /** false = relatório planejado, ainda não implementado (aparece como "em breve"). */
  available: boolean;
};

export const REPORT_TYPES: ReportType[] = [
  {
    key: "organization-summary",
    title: "Resumo da organização",
    description: "PDF com os indicadores gerais (KPIs, riscos e pendências) do tenant.",
    available: true,
  },
  {
    key: "esocial-events",
    title: "Eventos eSocial (consolidado)",
    description: "Exportação consolidada de eventos eSocial. Planejado.",
    available: false,
  },
  {
    key: "onboarding-manual",
    title: "Manual de onboarding",
    description: "Guia de uso da plataforma para novos usuários. Planejado.",
    available: false,
  },
];

export function findReportType(key: string): ReportType | undefined {
  return REPORT_TYPES.find((r) => r.key === key);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Monta o HTML do relatório "Resumo da organização" (puro/testável). O HTML é
 * gerado no servidor APÓS checar o tenant (Princípio I) e enviado ao Gotenberg.
 */
export function buildOrgSummaryHtml(
  orgName: string,
  summary: DashboardSummary,
  generatedAt: string,
): string {
  const k = summary.kpis;
  const p = summary.pending;
  const rows = (items: { label: string; count: number }[]) =>
    items
      .map((i) => `<tr><td>${escapeHtml(i.label)}</td><td>${i.count}</td></tr>`)
      .join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:40px}
h1{font-size:20px} h2{font-size:14px;margin-top:24px}
table{border-collapse:collapse;width:100%;font-size:12px}
td{border-bottom:1px solid #ddd;padding:6px 4px}
.meta{color:#666;font-size:11px}
</style></head><body>
<h1>Resumo da organização — ${escapeHtml(orgName)}</h1>
<p class="meta">Gerado em ${escapeHtml(generatedAt)}</p>
<h2>Indicadores</h2>
<table>${rows([
    { label: "Empresas", count: k.companies },
    { label: "Funcionários", count: k.employees },
    { label: "Unidades de obra", count: k.workUnits },
    { label: "GES", count: k.ges },
    { label: "Riscos", count: k.risks },
    { label: "PGRs", count: k.pgrs },
  ])}</table>
<h2>Pendências</h2>
<table>${rows([
    { label: "PGRs vencidos", count: p.pgrsExpired },
    { label: "Controles em atraso", count: p.controlsOverdue },
    { label: "EPIs abaixo do mínimo", count: p.episLowStock },
    { label: "EPIs a devolver", count: p.episPendingReturn },
    { label: "Treinamentos vencidos", count: p.trainingsExpired },
    { label: "Treinamentos a vencer", count: p.trainingsDueSoon },
  ])}</table>
</body></html>`;
}
