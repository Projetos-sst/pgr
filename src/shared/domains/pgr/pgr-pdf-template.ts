import { pgrRegistrationTypeLabel } from "./pgr";
import {
  controlLevelLabel,
  measureStateLabel,
  measurementUnitLabel,
  riskClassificationLabel,
  riskAgentTypeLabel,
  exposureTimeLabel,
  planCoverageLabel,
  sortConsolidatedRisks,
  formatMeasurement,
  hasNr09Measurement,
  isNr09EligibleAgent,
  nr09ConclusionLabel,
  NO_ERGONOMIC_EVALUATION_LABEL,
  PSYCHOSOCIAL_AGGREGATE_LABEL,
  ergonomicAdequacyText,
  formatCampaignPeriod,
  type ConsolidatedAddress,
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

export type PgrPdfSectionKey =
  | "identification"
  | "risks"
  | "nr09"
  | "nr17"
  | "actionPlan"
  | "controlHierarchy";

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

/**
 * Ordem e títulos das seções do documento (#47). A numeração é **sequencial pelo que
 * existe** — desligar uma seção renumera as seguintes sozinha. A NR-17 (#40) entra
 * entre a NR-09 e o plano de ação: é avaliação de risco, vem antes do plano que dela
 * decorre.
 */
const SECTION_ORDER: PgrPdfSectionKey[] = [
  "identification",
  "risks",
  "nr09",
  "nr17",
  "actionPlan",
  "controlHierarchy",
];

const SECTION_LABELS: Record<PgrPdfSectionKey, string> = {
  identification: "Identificação",
  risks: "Inventário de riscos (NR-01)",
  nr09: "Avaliação quantitativa de agentes (NR-09)",
  nr17: "Avaliação ergonômica (NR-17)",
  actionPlan: "Plano de ação (5W2H)",
  controlHierarchy: "Hierarquia de controles (NR-01)",
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
    identification: sections?.identification ?? true,
    risks: sections?.risks ?? true,
    nr09: sections?.nr09 ?? true,
    nr17: sections?.nr17 ?? true,
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

/** Seções ligadas, na ordem do documento — usada pelo sumário e pelo corpo. */
function activeSections(sections: Record<PgrPdfSectionKey, boolean>): PgrPdfSectionKey[] {
  return SECTION_ORDER.filter((key) => sections[key]);
}

function summaryBlock(sections: Record<PgrPdfSectionKey, boolean>): string {
  const items = activeSections(sections).map((key) => SECTION_LABELS[key]);
  return `<section class="summary"><h2>Sumário</h2><ol>${items
    .map((i) => `<li>${escapeHtml(i)}</li>`)
    .join("")}</ol></section>`;
}

// ---------------------------------------------------------------------------
// Seção 1 — Identificação (#47)
// ---------------------------------------------------------------------------

/** Endereço numa linha; `null` quando não há nenhuma parte preenchida. */
function formatAddress(address: ConsolidatedAddress | undefined): string | null {
  if (!address) return null;
  const street = [address.street, address.number].filter(Boolean).join(", ");
  const local = [address.district, address.city, address.state]
    .filter(Boolean)
    .join(" · ");
  const line = [street, address.complement, local, address.zipCode]
    .map((part) => part?.trim())
    .filter((part) => part && part.length > 0)
    .join(" — ");
  return line || null;
}

/** Tabela rótulo/valor; linhas sem valor saem como "não informado" (estado honesto). */
function definitionTable(rows: [string, string | null | undefined][]): string {
  const body = rows
    .map(
      ([label, value]) =>
        `<tr><td>${escapeHtml(label)}</td><td>${
          value && String(value).trim()
            ? escapeHtml(String(value).trim())
            : '<span class="muted">não informado</span>'
        }</td></tr>`,
    )
    .join("");
  return `<table class="definition">${body}</table>`;
}

function identificationBlock(data: PgrConsolidated): string {
  const { pgr } = data;
  const company = pgr.company ?? null;
  const unit = pgr.workUnit ?? null;
  const registration = [
    pgrRegistrationTypeLabel(pgr.registrationType),
    pgr.registrationNumber,
  ]
    .filter(Boolean)
    .join(" · ");

  const companyRows: [string, string | null | undefined][] = [
    ["Razão social", company?.razaoSocial ?? pgr.companyName],
    ["Nome fantasia", company?.nomeFantasia],
    ["CNPJ", company?.cnpj],
    ["CNAE", company?.cnae],
    ["Atividade principal", company?.mainActivity],
    [
      "Grau de risco (NR-04)",
      company?.riskGrade != null ? String(company.riskGrade) : null,
    ],
    ["Endereço", formatAddress(company?.address)],
    ["Site", company?.website ?? pgr.companyWebsite],
  ];

  const unitRows: [string, string | null | undefined][] = [
    ["Unidade / obra", unit?.name ?? pgr.workUnitName],
    ["Nº do contrato", unit?.contractNumber],
    ["Endereço", formatAddress(unit?.address)],
    ["Início", unit?.startDate],
    ["Previsão de término", unit?.expectedEndDate],
  ];

  const responsibleRows: [string, string | null | undefined][] = [
    ["Nome", pgr.responsible],
    ["Registro profissional", registration || null],
    ["ART anexada", pgr.artDocumentName],
    ["Emissão do documento", pgr.issuedAt],
    ["Validade", pgr.validUntil],
  ];

  // Preposto = `work_units.manager_name`/`manager_role` (rótulo "Gestor/Preposto" no
  // cadastro da unidade). Sem campo preenchido, fica "não informado" — nunca um nome
  // emprestado de outro papel.
  const prepostoRows: [string, string | null | undefined][] = [
    ["Nome", unit?.managerName],
    ["Cargo", unit?.managerRole],
    ["Título profissional", unit?.professionalTitle],
    ["Registro no conselho", unit?.professionalRegistration],
  ];

  return `<section class="doc-section">
    <h2>1. Identificação</h2>
    <h3>Empresa</h3>${definitionTable(companyRows)}
    <h3>Unidade / obra</h3>${definitionTable(unitRows)}
    <h3>Responsável técnico pela elaboração</h3>${definitionTable(responsibleRows)}
    <h3>Preposto / gestor da unidade</h3>${definitionTable(prepostoRows)}
  </section>`;
}

function assessmentLine(risk: ConsolidatedRisk): string {
  if (!risk.assessment) return `<span class="muted">Sem avaliação</span>`;
  const a = risk.assessment;
  const result = a.result ? riskClassificationLabel(a.result) : "—";
  return `Prob. ${a.probability} × Sev. ${a.severity} = Nível <strong>${a.riskLevel}</strong> (${escapeHtml(result)})`;
}

/** Código eSocial + unidade + concentração de referência, já no consolidado (#47). */
function riskReferenceCell(risk: ConsolidatedRisk): string {
  const parts = [
    risk.noxiousAgentCode ? `eSocial ${risk.noxiousAgentCode}` : null,
    formatMeasurement(risk.concentrationIntensity, risk.measurementUnit),
    risk.measurementUnit && !risk.concentrationIntensity
      ? measurementUnitLabel(risk.measurementUnit)
      : null,
    risk.assessment?.toleranceLimit ? `LT: ${risk.assessment.toleranceLimit}` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length ? escapeHtml(parts.join(" · ")) : "—";
}

function riskEpisCell(risk: ConsolidatedRisk): string {
  if (risk.epis.length === 0) return `<span class="muted">Sem EPI indicado</span>`;
  return escapeHtml(
    risk.epis.map((e) => (e.ca ? `${e.name} (CA ${e.ca})` : e.name)).join(", "),
  );
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
        <td>${riskReferenceCell(r)}</td>
        <td>${riskEpisCell(r)}</td>
        <td>${escapeHtml(planCoverageLabel(r.planCoverage))}</td>
      </tr>`,
    )
    .join("");
  return `<table class="grid">
    <thead><tr><th>Agente</th><th>Descrição</th><th>Fontes</th><th>Exposição</th><th>Avaliação</th><th>Referências</th><th>EPIs</th><th>Plano</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

// ---------------------------------------------------------------------------
// Seção 3 — NR-09 (#39 + #47)
// ---------------------------------------------------------------------------

/**
 * Só agentes físicos/químicos/biológicos entram. Risco elegível **sem** medição aparece
 * como "sem medição" — ausência de medição nunca vira conformidade; risco não elegível
 * fica fora da tabela e o total é declarado embaixo, em vez de sumir sem explicação.
 */
function nr09Block(risks: ConsolidatedRisk[]): string {
  const eligible = risks.filter((r) => isNr09EligibleAgent(r.agentType));
  const ineligible = risks.length - eligible.length;
  const footer = ineligible
    ? `<p class="muted">${ineligible} risco(s) deste GES não são objeto da NR-09 (agentes ergonômicos, mecânicos, de acidentes ou psicossociais).</p>`
    : "";

  if (eligible.length === 0) {
    return `<p class="muted">Nenhum agente físico, químico ou biológico neste GES.</p>${footer}`;
  }

  const rows = eligible
    .map((r) => {
      const a = r.assessment;
      const measured = formatMeasurement(a?.measuredValue, a?.measuredUnit ?? null);
      const limit = formatMeasurement(a?.toleranceLimitValue, a?.measuredUnit ?? null);
      const semMedicao = !a || !hasNr09Measurement(a);
      if (semMedicao) {
        return `<tr>
          <td>${escapeHtml(riskAgentTypeLabel(r.agentType))}</td>
          <td>${text(r.description)}</td>
          <td colspan="5"><span class="muted">Sem medição registrada — avaliação quantitativa pendente.</span></td>
        </tr>`;
      }
      return `<tr>
        <td>${escapeHtml(riskAgentTypeLabel(r.agentType))}</td>
        <td>${text(r.description)}</td>
        <td>${text(a?.evaluationMethod)}</td>
        <td>${measured ? escapeHtml(measured) : "—"}</td>
        <td>${limit ? escapeHtml(limit) : text(a?.toleranceLimit)}</td>
        <td>${a?.nr09Conclusion ? escapeHtml(nr09ConclusionLabel(a.nr09Conclusion)) : '<span class="muted">não informada</span>'}</td>
        <td>${text(a?.assessedAt)}</td>
      </tr>`;
    })
    .join("");

  return `<table class="grid">
    <thead><tr><th>Agente</th><th>Descrição</th><th>Método</th><th>Resultado</th><th>Limite de tolerância</th><th>Conclusão</th><th>Data</th></tr></thead>
    <tbody>${rows}</tbody></table>${footer}`;
}

// ---------------------------------------------------------------------------
// Seção 4 — NR-17 (#40 + #47)
// ---------------------------------------------------------------------------

/**
 * Resultado **agregado** da campanha psicossocial vinculada à avaliação. Imprime nome,
 * período, número de respostas e os fatores derivados com nível. Nunca imprime resposta
 * individual (o view model sequer as carrega) e nunca chama isso de "escore COPSOQ" — o
 * sistema não implementa a metodologia, e documento legal não leva rótulo falso.
 */
function psychosocialAggregateBlock(risk: ConsolidatedRisk): string {
  const aggregate = risk.ergonomic?.psychosocial;
  if (!aggregate) return "";
  const period = formatCampaignPeriod(aggregate.startsAt, aggregate.endsAt);
  const factors = aggregate.factors.length
    ? `<table class="grid"><thead><tr><th>Fator psicossocial</th><th>Nível</th></tr></thead><tbody>${aggregate.factors
        .map(
          (f) =>
            `<tr><td>${text(f.factor)}</td><td>${escapeHtml(String(f.level))}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : `<p class="muted">Nenhum fator derivado nesta campanha.</p>`;
  return `<h5>${escapeHtml(PSYCHOSOCIAL_AGGREGATE_LABEL)}</h5>${definitionTable([
    ["Campanha", aggregate.name],
    ["Período", period],
    ["Respostas recebidas", String(aggregate.responseCount)],
  ])}${factors}`;
}

/** Bloco vertical de um risco avaliado — cabe em A4 sem tabela horizontal gigante. */
function nr17RiskBlock(risk: ConsolidatedRisk): string {
  const evaluation = risk.ergonomic!;
  const rows = evaluation.dimensions
    .map(
      (d) => `<tr>
        <td>${escapeHtml(d.label)}</td>
        <td>${escapeHtml(ergonomicAdequacyText(d.adequacy))}</td>
        <td>${text(d.notes)}</td>
      </tr>`,
    )
    .join("");
  const notes = evaluation.notes?.trim()
    ? `<p><strong>Observações gerais:</strong> ${escapeHtml(evaluation.notes.trim())}</p>`
    : "";
  return `<div class="nr17-risk">
    <h4>${escapeHtml(riskAgentTypeLabel(risk.agentType))} — ${text(risk.description)}</h4>
    ${definitionTable([
      ["Data da avaliação", evaluation.assessedAt],
      ["Responsável", evaluation.responsible],
      ["Método / instrumento", evaluation.method],
    ])}
    <table class="grid">
      <thead><tr><th>Dimensão</th><th>Situação</th><th>Observação</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${notes}
    ${psychosocialAggregateBlock(risk)}
  </div>`;
}

/**
 * Seção NR-17 de um GES. Risco avaliado vira bloco completo; risco **sem** avaliação é
 * declarado nominalmente — ausência de avaliação nunca some do documento nem vira
 * "adequado". "Não avaliado" (dimensão em branco) e "Não aplicável" (declaração do
 * profissional) também continuam distintos.
 */
function nr17Block(risks: ConsolidatedRisk[]): string {
  if (risks.length === 0) return `<p class="muted">GES sem riscos.</p>`;
  const evaluated = risks.filter((r) => r.ergonomic);
  const pending = risks.filter((r) => !r.ergonomic);
  const pendingBlock = pending.length
    ? `<p class="muted">${escapeHtml(NO_ERGONOMIC_EVALUATION_LABEL)}: ${pending
        .map((r) => text(r.description))
        .join("; ")}.</p>`
    : "";
  if (evaluated.length === 0) {
    return `<p class="muted">${escapeHtml(NO_ERGONOMIC_EVALUATION_LABEL)} para os riscos deste GES.</p>${pendingBlock}`;
  }
  return `${evaluated.map(nr17RiskBlock).join("")}${pendingBlock}`;
}

/** Custo em BRL; `null` quando a medida não tem custo informado (não inventa zero). */
function formatCost(value: string | null): string | null {
  if (!value || !value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

/**
 * Plano de ação 5W2H completo (#47), lido **sempre** de `control_measures`:
 * o quê/por quê/onde/quando/quem/como/quanto. O "onde" é o GES do risco — dado real do
 * cadastro. A ponte #51 (`action_plans`) **não** alimenta esta seção: lá `who`, `why` e
 * `where` podem ser texto gerado pelo sistema, e documento legal não leva texto inventado.
 * Campo vazio sai como "não informado".
 */
function actionPlanBlock(risks: ConsolidatedRisk[], gesName: string): string {
  const cell = (value: string | null | undefined) =>
    value && String(value).trim()
      ? escapeHtml(String(value).trim())
      : '<span class="muted">não informado</span>';

  const rows = risks
    .flatMap((r) =>
      r.measures
        .filter((m) => m.applicable)
        .map(
          (m) => `<tr>
            <td>${escapeHtml(controlLevelLabel(m.controlLevel))}</td>
            <td>${cell(m.actionWhat)}</td>
            <td>${cell(m.actionWhy)}</td>
            <td>${cell(gesName)}</td>
            <td>${cell(m.actionDeadline)}</td>
            <td>${cell(m.actionResponsible)}</td>
            <td>${cell(m.actionHow)}</td>
            <td>${cell(formatCost(m.actionCost))}</td>
            <td>${escapeHtml(measureStateLabel(m.state))}</td>
          </tr>`,
        ),
    )
    .join("");
  if (!rows) return `<p class="muted">Sem medidas de controle aplicáveis.</p>`;
  return `<table class="grid">
    <thead><tr><th>Nível NR-01</th><th>O quê</th><th>Por quê</th><th>Onde</th><th>Quando</th><th>Quem</th><th>Como</th><th>Quanto</th><th>Situação</th></tr></thead>
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

/** Um bloco por GES dentro de uma seção do documento. */
function perGesBlock(
  data: PgrConsolidated,
  render: (risks: ConsolidatedRisk[], ges: ConsolidatedGes) => string,
): string {
  if (data.ges.length === 0) return `<p class="muted">PGR sem GES cadastrados.</p>`;
  return data.ges
    .map((g) => {
      const risks = sortConsolidatedRisks(g.risks);
      return `<div class="ges"><h3>GES — ${text(g.name)}</h3>${render(risks, g)}</div>`;
    })
    .join("");
}

function sectionBlock(
  key: PgrPdfSectionKey,
  index: number,
  data: PgrConsolidated,
): string {
  const title = `${index}. ${SECTION_LABELS[key]}`;
  if (key === "identification") {
    return identificationBlock(data).replace(
      "<h2>1. Identificação</h2>",
      `<h2>${escapeHtml(title)}</h2>`,
    );
  }
  const body =
    key === "risks"
      ? perGesBlock(data, (risks) => riskInventoryBlock(risks))
      : key === "nr09"
        ? perGesBlock(data, (risks) => nr09Block(risks))
        : key === "nr17"
          ? perGesBlock(data, (risks) => nr17Block(risks))
          : key === "actionPlan"
            ? perGesBlock(data, (risks, ges) => actionPlanBlock(risks, ges.name))
            : perGesBlock(data, (risks) => controlHierarchyBlock(risks));
  return `<section class="doc-section"><h2>${escapeHtml(title)}</h2>${body}</section>`;
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
  const body = activeSections(sections)
    .map((key, i) => sectionBlock(key, i + 1, data))
    .join("");

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
.doc-section { page-break-inside: auto; margin-top: 18px; }
.ges { page-break-inside: avoid; margin-top: 14px; }
table.definition { border-collapse: collapse; width: 100%; margin: 4px 0 10px; }
table.definition td { border-bottom: 1px solid #e8e8e8; padding: 4px 6px; vertical-align: top; }
table.definition td:first-child { width: 220px; color: #555; font-weight: 600; }
table.grid thead { display: table-header-group; }
table.grid tr { page-break-inside: avoid; }
table.grid { border-collapse: collapse; width: 100%; margin: 4px 0 8px; }
table.grid th, table.grid td { border: 1px solid #d5d5d5; padding: 4px 6px; text-align: left; vertical-align: top; }
table.grid th { background: #f3f3f6; font-size: 10px; }
h5 { font-size: 11px; margin: 10px 0 4px; color: #444; }
.nr17-risk { page-break-inside: avoid; margin: 8px 0 12px; padding-bottom: 6px; border-bottom: 1px dashed #e0e0e0; }
.nr17-risk:last-child { border-bottom: none; }
.nr17-risk h4 { margin: 0 0 4px; }
.hierarchy { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.hierarchy-level { border: 1px solid #e2e2e2; border-radius: 4px; padding: 6px 8px; }
.hierarchy-level h4 { margin: 0 0 4px; color: ${coverColor}; }
.hierarchy-level ul { margin: 0 0 0 16px; }
</style></head><body>
${coverBlock(data, { coverColor, generatedAt: options.generatedAt, logoDataUrl: options.logoDataUrl })}
${header}
${summaryBlock(sections)}
${body}
</body></html>`;
}
