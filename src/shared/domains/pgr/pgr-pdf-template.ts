import { pgrRegistrationTypeLabel } from "./pgr";
import {
  controlLevelLabel,
  measureStateLabel,
  riskClassificationLabel,
  riskAgentTypeLabel,
  exposureTimeLabel,
  sortConsolidatedRisks,
  type ConsolidatedGes,
  type ConsolidatedRisk,
  type ControlLevel,
  type PgrConsolidated,
} from "./pgr-consolidated";

/** Cor padrão da capa (indigo do design system) — sobrescrita por parâmetro (fatia #40). */
export const DEFAULT_COVER_COLOR = "#5b63f5";

/** Ordem canônica da hierarquia de controles (eliminação → … → EPI). */
const CONTROL_LEVEL_ORDER: ControlLevel[] = [
  "elimination",
  "collective_protection",
  "administrative",
  "ppe",
];

export type PgrPdfSectionKey = "risks" | "actionPlan" | "controlHierarchy";

export type PgrFormHeader = {
  code?: string | null; // FRM
  revision?: string | null; // REV
  date?: string | null;
  nonConformity?: string | null; // N.C.
};

export type PgrPdfOptions = {
  /** Cor da capa e dos títulos (default `DEFAULT_COVER_COLOR`). */
  coverColor?: string;
  /** Logo da empresa como data URL (`null`/ausente = sem logo). */
  logoDataUrl?: string | null;
  /** Seções incluídas no sumário/corpo (default: todas). */
  sections?: Partial<Record<PgrPdfSectionKey, boolean>>;
  /** Cabeçalho de controle de formulário (FRM/REV/data/N.C.). Ausente = não renderiza. */
  formHeader?: PgrFormHeader | null;
  /** Data de geração (YYYY-MM-DD). */
  generatedAt: string;
};

const SECTION_LABELS: Record<PgrPdfSectionKey, string> = {
  risks: "Inventário de riscos",
  actionPlan: "Plano de ação",
  controlHierarchy: "Hierarquia de controles",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(value: string | null | undefined, fallback = "—"): string {
  const trimmed = value?.trim();
  return trimmed ? escapeHtml(trimmed) : fallback;
}

function resolveSections(
  sections?: Partial<Record<PgrPdfSectionKey, boolean>>,
): Record<PgrPdfSectionKey, boolean> {
  return {
    risks: sections?.risks ?? true,
    actionPlan: sections?.actionPlan ?? true,
    controlHierarchy: sections?.controlHierarchy ?? true,
  };
}

function coverBlock(
  data: PgrConsolidated,
  options: Required<Pick<PgrPdfOptions, "coverColor" | "generatedAt">> & {
    logoDataUrl?: string | null;
  },
): string {
  const { pgr } = data;
  const logo = options.logoDataUrl
    ? `<img class="logo" src="${options.logoDataUrl}" alt="logo" />`
    : "";
  const registration =
    pgr.registrationType === "not_applicable"
      ? pgrRegistrationTypeLabel(pgr.registrationType)
      : `${pgrRegistrationTypeLabel(pgr.registrationType)} ${text(pgr.registrationNumber, "")}`;
  // Site/portal da empresa (issue #5) — linha condicional, some do cabeçalho
  // quando a empresa não preencheu `website`.
  const websiteRow = pgr.companyWebsite?.trim()
    ? `<tr><td>Site</td><td>${escapeHtml(pgr.companyWebsite.trim())}</td></tr>`
    : "";
  // ART anexada ao responsável técnico (issue #36) — linha condicional, some quando
  // não há documento de ART com status "ready" vinculado a este PGR.
  const artRow = pgr.artDocumentName?.trim()
    ? `<tr><td>ART</td><td>${escapeHtml(pgr.artDocumentName.trim())}</td></tr>`
    : "";
  return `<section class="cover">
    <div class="cover-band"></div>
    ${logo}
    <h1>Programa de Gerenciamento de Riscos</h1>
    <table class="cover-meta">
      <tr><td>Empresa</td><td>${text(pgr.companyName)}</td></tr>
      ${websiteRow}
      <tr><td>Unidade</td><td>${text(pgr.workUnitName)}</td></tr>
      <tr><td>Responsável técnico</td><td>${text(pgr.responsible)}</td></tr>
      ${artRow}
      <tr><td>Registro</td><td>${registration}</td></tr>
      <tr><td>Emitido em</td><td>${text(pgr.issuedAt)}</td></tr>
      <tr><td>Válido até</td><td>${text(pgr.validUntil)}</td></tr>
      <tr><td>Gerado em</td><td>${escapeHtml(options.generatedAt)}</td></tr>
    </table>
  </section>`;
}

function formHeaderBlock(header: PgrFormHeader): string {
  return `<div class="form-control">
    <span><strong>FRM:</strong> ${text(header.code)}</span>
    <span><strong>REV:</strong> ${text(header.revision)}</span>
    <span><strong>Data:</strong> ${text(header.date)}</span>
    <span><strong>N.C.:</strong> ${text(header.nonConformity)}</span>
  </div>`;
}

function summaryBlock(sections: Record<PgrPdfSectionKey, boolean>): string {
  const items = ["Caracterização dos GES"];
  (Object.keys(SECTION_LABELS) as PgrPdfSectionKey[]).forEach((key) => {
    if (sections[key]) items.push(SECTION_LABELS[key]);
  });
  return `<section class="summary"><h2>Sumário</h2><ol>${items
    .map((i) => `<li>${escapeHtml(i)}</li>`)
    .join("")}</ol></section>`;
}

function assessmentLine(risk: ConsolidatedRisk): string {
  if (!risk.assessment) return `<span class="muted">Sem avaliação</span>`;
  const a = risk.assessment;
  const result = a.result ? riskClassificationLabel(a.result) : "—";
  return `Prob. ${a.probability} × Sev. ${a.severity} = Nível <strong>${a.riskLevel}</strong> (${escapeHtml(result)})`;
}

function riskInventoryBlock(risks: ConsolidatedRisk[]): string {
  if (risks.length === 0) return `<p class="muted">GES sem riscos.</p>`;
  const rows = risks
    .map(
      (r) => `<tr>
        <td>${escapeHtml(riskAgentTypeLabel(r.agentType))}</td>
        <td>${text(r.description)}</td>
        <td>${text(r.sources)}</td>
        <td>${r.exposureTime ? escapeHtml(exposureTimeLabel(r.exposureTime)) : "—"}</td>
        <td>${assessmentLine(r)}</td>
      </tr>`,
    )
    .join("");
  return `<table class="grid">
    <thead><tr><th>Agente</th><th>Descrição</th><th>Fontes</th><th>Exposição</th><th>Avaliação</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function actionPlanBlock(risks: ConsolidatedRisk[]): string {
  const rows = risks
    .flatMap((r) =>
      r.measures
        .filter((m) => m.applicable)
        .map(
          (m) => `<tr>
            <td>${escapeHtml(controlLevelLabel(m.controlLevel))}</td>
            <td>${text(m.actionWhat)}</td>
            <td>${text(m.actionHow)}</td>
            <td>${text(m.actionResponsible)}</td>
            <td>${text(m.actionDeadline)}</td>
            <td>${escapeHtml(measureStateLabel(m.state))}</td>
          </tr>`,
        ),
    )
    .join("");
  if (!rows) return `<p class="muted">Sem medidas de controle aplicáveis.</p>`;
  return `<table class="grid">
    <thead><tr><th>Nível</th><th>O quê</th><th>Como</th><th>Responsável</th><th>Prazo</th><th>Situação</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function controlHierarchyBlock(risks: ConsolidatedRisk[]): string {
  const measures = risks.flatMap((r) => r.measures);
  const groups = CONTROL_LEVEL_ORDER.map((level) => {
    const inLevel = measures.filter((m) => m.controlLevel === level);
    const items = inLevel
      .map(
        (m) =>
          `<li>${m.applicable ? "" : '<span class="muted">[não aplicável] </span>'}${text(
            m.actionWhat ?? m.justification,
          )}</li>`,
      )
      .join("");
    return `<div class="hierarchy-level"><h4>${escapeHtml(controlLevelLabel(level))}</h4>${
      items ? `<ul>${items}</ul>` : '<p class="muted">—</p>'
    }</div>`;
  }).join("");
  return `<div class="hierarchy">${groups}</div>`;
}

function gesBlock(
  ges: ConsolidatedGes,
  sections: Record<PgrPdfSectionKey, boolean>,
): string {
  const risks = sortConsolidatedRisks(ges.risks);
  const parts = [`<h3>GES — ${text(ges.name)}</h3>`];
  if (sections.risks) {
    parts.push(`<h4>Inventário de riscos</h4>${riskInventoryBlock(risks)}`);
  }
  if (sections.actionPlan) {
    parts.push(`<h4>Plano de ação</h4>${actionPlanBlock(risks)}`);
  }
  if (sections.controlHierarchy) {
    parts.push(`<h4>Hierarquia de controles</h4>${controlHierarchyBlock(risks)}`);
  }
  return `<section class="ges">${parts.join("")}</section>`;
}

/**
 * Monta o HTML do documento do PGR (puro/testável). Reusa a leitura consolidada
 * (fatia 022) sem duplicar lógica de dados. CSS de impressão A4 compatível com o
 * Chromium do Gotenberg. Capa com cor **parametrizável** (default) e logo opcional;
 * sumário configurável; cabeçalho de controle de formulário opcional.
 */
export function buildPgrHtml(data: PgrConsolidated, options: PgrPdfOptions): string {
  const coverColor = options.coverColor?.trim() || DEFAULT_COVER_COLOR;
  const sections = resolveSections(options.sections);
  const header = options.formHeader ? formHeaderBlock(options.formHeader) : "";
  const body =
    data.ges.length === 0
      ? `<p class="muted">PGR sem GES cadastrados.</p>`
      : data.ges.map((g) => gesBlock(g, sections)).join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>PGR — ${text(data.pgr.companyName)}</title>
<style>
@page { size: A4; margin: 18mm 14mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 11px; margin: 0; }
h1 { font-size: 22px; margin: 16px 0; color: ${coverColor}; }
h2 { font-size: 15px; margin: 20px 0 8px; color: ${coverColor}; border-bottom: 2px solid ${coverColor}; padding-bottom: 3px; }
h3 { font-size: 13px; margin: 16px 0 6px; color: ${coverColor}; }
h4 { font-size: 12px; margin: 12px 0 4px; }
.muted { color: #777; }
.cover { position: relative; page-break-after: always; padding-top: 8px; }
.cover-band { height: 10px; background: ${coverColor}; border-radius: 4px; margin-bottom: 20px; }
.cover .logo { max-height: 64px; max-width: 220px; object-fit: contain; }
.cover-meta { border-collapse: collapse; width: 100%; margin-top: 12px; }
.cover-meta td { padding: 6px 8px; border-bottom: 1px solid #e2e2e2; }
.cover-meta td:first-child { width: 180px; color: #555; font-weight: 600; }
.form-control { display: flex; gap: 16px; flex-wrap: wrap; font-size: 10px; border: 1px solid #ccc; padding: 6px 10px; border-radius: 4px; margin-bottom: 12px; }
.summary ol { margin: 4px 0 0 18px; }
.summary li { padding: 2px 0; }
.ges { page-break-inside: avoid; margin-top: 14px; }
table.grid { border-collapse: collapse; width: 100%; margin: 4px 0 8px; }
table.grid th, table.grid td { border: 1px solid #d5d5d5; padding: 4px 6px; text-align: left; vertical-align: top; }
table.grid th { background: #f3f3f6; font-size: 10px; }
.hierarchy { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.hierarchy-level { border: 1px solid #e2e2e2; border-radius: 4px; padding: 6px 8px; }
.hierarchy-level h4 { margin: 0 0 4px; color: ${coverColor}; }
.hierarchy-level ul { margin: 0 0 0 16px; }
</style></head><body>
${coverBlock(data, { coverColor, generatedAt: options.generatedAt, logoDataUrl: options.logoDataUrl })}
${header}
${summaryBlock(sections)}
<h2>Caracterização dos GES e riscos</h2>
${body}
</body></html>`;
}
