import type { EventListItem } from "@/shared/domains/esocial/events";

import type { DashboardSummary } from "./dashboard";
import { ONBOARDING_STEPS } from "./onboarding";

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
    description: "PDF consolidado dos eventos eSocial do tenant (tipo, situação e lote).",
    available: true,
  },
  {
    key: "onboarding-manual",
    title: "Manual de onboarding",
    description: "Guia de primeiros passos da plataforma para novos usuários.",
    available: true,
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

const REPORT_STYLE = `body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:40px}
h1{font-size:20px} h2{font-size:14px;margin-top:24px}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left}
th{background:#f3f3f6;font-size:11px}
.meta{color:#666;font-size:11px} .muted{color:#777}`;

function countBy<T extends string>(values: T[]): { label: T; count: number }[] {
  const map = new Map<T, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * HTML do relatório consolidado de eventos eSocial (#83) — puro/testável. Recebe
 * os eventos JÁ escopados pelo tenant (Princípio I; o isolamento vem do
 * repositório `withOrg`). Resumo por situação + tabela detalhada.
 */
export function buildEsocialEventsHtml(
  orgName: string,
  events: EventListItem[],
  generatedAt: string,
): string {
  const summary = countBy(events.map((e) => e.statusLabel));
  const summaryRows = summary
    .map((s) => `<tr><td>${escapeHtml(s.label)}</td><td>${s.count}</td></tr>`)
    .join("");
  const eventRows = events
    .map(
      (e) => `<tr>
        <td>${escapeHtml(e.eventTypeLabel)}</td>
        <td>${escapeHtml(e.statusLabel)}</td>
        <td>${e.referenceId ? escapeHtml(e.referenceId) : "—"}</td>
        <td>${e.batchId ? escapeHtml(e.batchId) : "—"}</td>
        <td>${escapeHtml(e.createdAt.slice(0, 10))}</td>
      </tr>`,
    )
    .join("");
  const detail =
    events.length === 0
      ? `<p class="muted">Nenhum evento eSocial registrado.</p>`
      : `<table><thead><tr><th>Tipo</th><th>Situação</th><th>Referência</th><th>Lote</th><th>Criado em</th></tr></thead><tbody>${eventRows}</tbody></table>`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>${REPORT_STYLE}</style></head><body>
<h1>Eventos eSocial (consolidado) — ${escapeHtml(orgName)}</h1>
<p class="meta">Gerado em ${escapeHtml(generatedAt)} · ${events.length} evento(s)</p>
<h2>Resumo por situação</h2>
<table><thead><tr><th>Situação</th><th>Qtde.</th></tr></thead><tbody>${
    summaryRows || `<tr><td class="muted">—</td><td>0</td></tr>`
  }</tbody></table>
<h2>Eventos</h2>
${detail}
</body></html>`;
}

/**
 * HTML do manual de onboarding (#83) — conteúdo estático a partir dos passos de
 * primeiros passos (`ONBOARDING_STEPS`). Puro/testável; não depende do tenant.
 */
export function buildOnboardingManualHtml(orgName: string, generatedAt: string): string {
  const steps = ONBOARDING_STEPS.map(
    (s, i) =>
      `<li><strong>${i + 1}. ${escapeHtml(s.title)}</strong><br>
       ${escapeHtml(s.description)} <span class="muted">(${escapeHtml(s.href)})</span></li>`,
  ).join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>${REPORT_STYLE} ol{padding-left:18px} li{margin:8px 0}</style></head><body>
<h1>Manual de onboarding — ${escapeHtml(orgName)}</h1>
<p class="meta">Gerado em ${escapeHtml(generatedAt)}</p>
<h2>Bem-vindo(a) ao PGR-e</h2>
<p>Este guia apresenta os primeiros passos para colocar o seu escritório em
operação. Siga a cadeia abaixo, na ordem — cada passo habilita o próximo até a
emissão do documento PGR.</p>
<h2>Primeiros passos</h2>
<ol>${steps}</ol>
<h2>Boas práticas</h2>
<ul>
<li>Mantenha os cadastros de empresas e funcionários atualizados — eles alimentam todos os módulos.</li>
<li>Acompanhe o painel: vencimentos de PGR, treinamentos e EPIs abaixo do mínimo aparecem como pendências.</li>
<li>Use os relatórios em PDF para arquivar e apresentar o acervo do escritório.</li>
</ul>
</body></html>`;
}
