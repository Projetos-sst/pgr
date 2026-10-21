import { campaignsXml, riskMatrixXml, trainingMatrixXml } from "./blocks";
import type {
  PgrDocxContent,
  PgrDocxGes,
  PgrDocxMeasureLevel,
  PgrDocxRisk,
} from "./content";
import { buildCoverXml } from "./cover";
import {
  DEFAULT_CAMPAIGNS,
  DEFAULT_LABELS,
  DEFAULT_METHODOLOGY,
  DEFAULT_TEXTS,
  DEFAULT_TITLES,
  RISK_MATRIX_ASYMMETRY_NOTE,
  SUMMARY_ORDER,
  type PgrDocxCampaign,
  type PgrDocxLabelKey,
  type PgrDocxMethodology,
  type PgrDocxTextKey,
  type PgrDocxTitleKey,
  type RichBlock,
} from "./defaults";
import { PGR_DOCX_CONTENT_WIDTH, PGR_DOCX_STYLE_IDS, paragraph, run } from "./ooxml";
import {
  riskBandMatrix,
  riskBandRanges,
  riskLevelLabels,
  riskMatrixClass,
} from "./risk-bands";
import { keepLastWords, plainTextToBlocks, richTextToOoxml } from "./rich-text";
import { jobRoleParts, wrapLines } from "./table-lines";
import { balancedText, textWidth } from "./text-fit";
import {
  PGR_DOCX_RISK_CLASS_COLORS,
  PGR_DOCX_RISK_CLASSES,
  PGR_DOCX_SIZES,
  type PgrDocxRiskClass,
} from "./theme";

/**
 * Monta o objeto de dados que o docxtemplater aplica sobre o template do PGR: o
 * conteúdo dinâmico (`PgrDocxContent`) + os valores semi-fixos (default ou override do
 * PGR) + os campos derivados (sumário, dashboard por GES, flags de cor, blocos OOXML).
 * Função pura — o mesmo resultado para o mesmo conteúdo, testável sem banco.
 */

/** Cores de fundo da anotação (template anotado = espelho do PGR 2026.1). */
export const PGR_DOCX_ANNOTATION = { fixed: "FFF1A8", semiFixed: "FFD2A6" } as const;

const CONTROL_NEED_PRIORITY_WIDTH = 1900;
const CONTROL_NEED_CELL_WIDTH = Math.floor(
  (PGR_DOCX_CONTENT_WIDTH - CONTROL_NEED_PRIORITY_WIDTH) / 3,
);
const TABLE_CELL_MARGIN = 140;
const JOB_ROLE_NAME_WIDTH = 2300;
const JOB_ROLE_DESCRIPTION_WIDTH = 4400;
const JOB_ROLE_WORKLOAD_WIDTH = 2500;
const KEEP_WHOLE_MAX_LINES = 14;
const RISK_CARD_WIDTH = 5233;
const MEASURE_RISK_WIDTH = 1500;
const MEASURE_TEXT_WIDTH = 2700;
const MEASURE_MONITORING_WIDTH = 2416;
const EPI_HAZARD_WIDTH = 3400;
const EPI_NAME_WIDTH = 3100;
const ACTION_FIELD_WIDTH = 2341;
const ANNEX_GES_WIDTH = 1800;
const ANNEX_RISK_WIDTH = 1900;
const ANNEX_ACTION_WIDTH = 2966;
const ANNEX_RESPONSIBLE_WIDTH = 1550;
const REVISION_DESCRIPTION_WIDTH = 3700;
const REVISION_RESPONSIBLE_WIDTH = 3466;
const CONSTRUCTION_CELL_WIDTH = 3489;
const CONSTRUCTION_LAST_WIDTH = PGR_DOCX_CONTENT_WIDTH - 2 * CONSTRUCTION_CELL_WIDTH;
const CONSTRUCTION_FIELDS: Record<
  keyof PgrDocxGes["construction"],
  { label: string; width: number }
> = {
  buildingType: { label: "Tipo de construção:", width: CONSTRUCTION_CELL_WIDTH },
  ceilingHeight: { label: "Pé-direito:", width: CONSTRUCTION_CELL_WIDTH },
  floor: { label: "Piso:", width: CONSTRUCTION_LAST_WIDTH },
  roof: { label: "Cobertura:", width: CONSTRUCTION_CELL_WIDTH },
  lighting: { label: "Iluminação:", width: CONSTRUCTION_CELL_WIDTH },
  ventilation: { label: "Ventilação:", width: CONSTRUCTION_LAST_WIDTH },
  other: { label: "Outras características:", width: PGR_DOCX_CONTENT_WIDTH },
};
const NBSP = "\u00A0";
const LIBREOFFICE_SLACK = 1.03;

function glueAbbrevNumber(text: string): string {
  return text.replace(/(^|[\s(])([A-ZÀ-Ý]{2,4}) (?=\d)/g, `$1$2${NBSP}`);
}

function glueSlash(text: string): string {
  return text.replace(/ \//g, `${NBSP}/`);
}

function glueLooseDash(text: string): string {
  return text.replace(/ ([\u2013-])(?=\p{L})/gu, `${NBSP}$1`);
}

function balanceTableText(original: string, columnWidth: number, bold = false): string {
  const text = glueLooseDash(glueSlash(glueAbbrevNumber(original)));
  const width = columnWidth - TABLE_CELL_MARGIN;
  if (text.includes("\n") || textWidth(text, PGR_DOCX_SIZES.table, bold) <= width) {
    return text;
  }
  return balancedText(text, { size: PGR_DOCX_SIZES.table, width, bold });
}

function wordCount(line: string): number {
  return line.split(/[ \u00A0]+/).filter(Boolean).length;
}

function penultimateHasTwoWords(text: string, width: number): boolean {
  const lines = wrapLines(text, width);
  return lines.length < 2 || wordCount(lines[lines.length - 2]) >= 2;
}

function slackWidths(usable: number): number[] {
  const top = Math.floor(usable * LIBREOFFICE_SLACK);
  const widths: number[] = [];
  for (let width = usable; width < top; width += 5) widths.push(width);
  return [...widths, top];
}

const keepHyphen = (word: string) => word.replace(/(?<=\p{L})-(?=\p{L})/gu, "\u2011");

function glueLastWords(original: string, columnWidth: number): string {
  const text = glueLooseDash(glueSlash(glueAbbrevNumber(original)));
  const trimmed = text.trim();
  if (trimmed.includes("\n")) return text;
  const match = trimmed.match(/^(.*\S) ([^ ]+) ([^ ]+)$/);
  if (!match) return text;
  const usable = columnWidth - TABLE_CELL_MARGIN;
  const pair = textWidth(`${match[2]} ${match[3]}`, PGR_DOCX_SIZES.table);
  if (pair * LIBREOFFICE_SLACK > usable) return text;
  const glued = `${match[1]} ${keepHyphen(match[2])}${NBSP}${keepHyphen(match[3])}`;
  const fallback = pair <= Math.floor(0.7 * usable) ? glued : text;
  if (wrapLines(trimmed, usable).length === 1) return fallback;
  const widths = slackWidths(usable);
  if (widths.every((width) => penultimateHasTwoWords(glued, width))) return glued;
  const before = match[1].match(/^(.*\S) ([^ ]+) ([^ ]+)$/);
  if (before) {
    const chained = `${before[1]} ${keepHyphen(before[2])}${NBSP}${keepHyphen(before[3])} ${keepHyphen(match[2])}${NBSP}${keepHyphen(match[3])}`;
    const tokensFit = chained
      .split(" ")
      .every(
        (token) => textWidth(token, PGR_DOCX_SIZES.table) * LIBREOFFICE_SLACK <= usable,
      );
    if (tokensFit && widths.every((width) => penultimateHasTwoWords(chained, width))) {
      return chained;
    }
  }
  return fallback;
}

function keepWorkloadTogether(text: string): string {
  return text
    .replace(/(\p{L})-(feira)/giu, "$1\u2011$2")
    .replace(
      /(\d{1,2}[h:]\d{0,2}(?:min)?) ([–-]) (\d{1,2}[h:]\d{0,2}(?:min)?)/gu,
      `$1${NBSP}$2${NBSP}$3`,
    )
    .replace(/ ([–-]) /g, `${NBSP}$1 `);
}

function upper(value: string): string {
  return value.includes("{{") ? value : value.toLocaleUpperCase("pt-BR");
}

function glueFields<T extends Record<string, unknown>>(
  record: T,
  widths: Partial<Record<keyof T, number>>,
): T {
  const result = { ...record };
  for (const [key, width] of Object.entries(widths) as [keyof T, number][]) {
    const value = record[key];
    if (typeof value === "string") {
      result[key] = glueLastWords(value, width) as T[keyof T];
    }
  }
  return result;
}

function glueAfterLabel(label: string, value: string, columnWidth: number): string {
  const trimmed = value.trim();
  if (trimmed.split(/\s+/).length < 3) return value;
  return glueLastWords(`${label} ${trimmed}`, columnWidth).slice(label.length + 1);
}

function buildConstruction(
  construction: PgrDocxGes["construction"],
): PgrDocxGes["construction"] {
  const filled = { ...construction, other: construction.other.trim() || "Não informado" };
  const glued = { ...filled };
  for (const key of Object.keys(CONSTRUCTION_FIELDS) as (keyof typeof filled)[]) {
    const { label, width } = CONSTRUCTION_FIELDS[key];
    glued[key] = glueAfterLabel(label, filled[key], width);
  }
  return glued;
}

function estimatedLines(text: string, columnWidth: number, bold = false): number {
  const width = columnWidth - TABLE_CELL_MARGIN;
  return text.split("\n").reduce((total, part) => {
    const partWidth = textWidth(part, PGR_DOCX_SIZES.table, bold);
    return total + Math.max(1, Math.ceil((1.1 * partWidth) / width));
  }, 0);
}

function jobRoleDescriptionXml(text: string) {
  return paragraph(run(text), { style: PGR_DOCX_STYLE_IDS.tableText, align: "left" });
}

function workUnitAddressXml(workUnit: PgrDocxContent["workUnit"]) {
  const lines = [workUnit.address, workUnit.addressCity]
    .map((line) => line.trim())
    .filter((line) => line !== "");
  return (lines.length > 0 ? lines : ["Não informado"])
    .map((line) =>
      paragraph(run(line), { style: PGR_DOCX_STYLE_IDS.body, align: "left" }),
    )
    .join("");
}

/** Valores semi-fixos alterados no PGR (o que não vier usa o default). */
export type PgrDocxOverrides = {
  labels?: Partial<Record<PgrDocxLabelKey, string>>;
  titles?: Partial<Record<PgrDocxTitleKey, string>>;
  /** Blocos ou texto livre (uma linha por parágrafo, ver `plainTextToBlocks`). */
  texts?: Partial<Record<PgrDocxTextKey, RichBlock[] | string>>;
  campaigns?: PgrDocxCampaign[];
  methodology?: Partial<PgrDocxMethodology>;
};

export type PgrDocxBuildOptions = {
  overrides?: PgrDocxOverrides;
  /** Pinta os trechos semi-fixos gerados em código (template anotado). */
  annotate?: boolean;
};

const NUMBER_WORDS = [
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "catorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
  "vinte",
];

/** "4" → "4 (quatro)" (até vinte); qualquer outro valor volta como veio. */
export function withNumberWord(value: string): string {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return value;
  const word = NUMBER_WORDS[Number(trimmed)];
  return word ? `${trimmed} (${word})` : value;
}

/** NR-05 (item 5.7.4): carga horária mínima do treinamento da CIPA por grau de risco. */
export const CIPA_TRAINING_HOURS: Record<string, string> = {
  "1": "8",
  "2": "12",
  "3": "16",
  "4": "20",
};

/** "08/2026 a 05/2028" → "2026–2028" (ano único → "2026"). */
export function validityYears(validity: string): string {
  const years = validity.match(/\d{4}/g) ?? [];
  if (years.length === 0) return "";
  const first = years[0];
  const last = years[years.length - 1];
  return first === last ? first : `${first}–${last}`;
}

/** Troca `{token}` (chaves simples) pelos valores conhecidos; desconhecidos ficam. */
export function fillTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => tokens[key] ?? match);
}

const EMPLOYEE_COUNT_CLAUSE = / e possuindo \{numeroEmpregados\} empregados/g;

function withoutMissingCipaData(
  text: string,
  present: { grade: boolean; employees: boolean; members: boolean; hours: boolean },
): string {
  let result = text;
  if (!present.grade && !present.employees) {
    result = result.replace(
      /, classificado com Grau de Risco \{grauRisco\} e possuindo \{numeroEmpregados\} empregados,/g,
      "",
    );
  }
  if (!present.grade) {
    result = result.replace(
      /classificado com Grau de Risco \{grauRisco\} e possuindo/g,
      "possuindo",
    );
  }
  if (!present.employees) {
    result = result.replace(EMPLOYEE_COUNT_CLAUSE, "");
  }
  if (!present.members) {
    result = result.replace(
      /\{cipaTitulares\} representantes titulares e \{cipaSuplentes\} representantes suplentes/g,
      "representantes titulares e suplentes",
    );
  }
  if (!present.hours) {
    result = result.replace(
      /com carga horária mínima de \{cipaHorasTreinamento\} horas, por se tratar de estabelecimento classificado em Grau de Risco \{grauRisco\}/g,
      "com a carga horária mínima prevista para o grau de risco do estabelecimento",
    );
  }
  if (!present.grade) {
    result = result.replace(
      /, por se tratar de estabelecimento classificado em Grau de Risco \{grauRisco\}/g,
      "",
    );
  }
  return result;
}

function withSingularCipaMembers(
  text: string,
  singular: { effective: boolean; alternate: boolean },
): string {
  let result = text;
  if (singular.effective) {
    result = result.replace(
      /\{cipaTitulares\} representantes titulares/g,
      "{cipaTitulares} representante titular",
    );
  }
  if (singular.alternate) {
    result = result.replace(
      /\{cipaSuplentes\} representantes suplentes/g,
      "{cipaSuplentes} representante suplente",
    );
  }
  return result;
}

const withoutEmptyParentheses = (text: string) => text.replace(/\s*\(\s*\)/g, "");

function defined<T extends object>(value: T | undefined): Partial<T> {
  if (!value) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined && v !== null),
  ) as Partial<T>;
}

function mapRecord<K extends string, V, R>(
  record: Record<K, V>,
  fn: (value: V, key: K) => R,
) {
  return Object.fromEntries(
    (Object.entries(record) as [K, V][]).map(([key, value]) => [key, fn(value, key)]),
  ) as Record<K, R>;
}

function riskClassFlags(riskClass: PgrDocxRiskClass | null) {
  return riskClass ? { [riskClass]: true } : {};
}

export function countRisksByClass(risks: PgrDocxRisk[]) {
  const counts = Object.fromEntries(PGR_DOCX_RISK_CLASSES.map((c) => [c, 0])) as Record<
    PgrDocxRiskClass,
    number
  >;
  for (const risk of risks) if (risk.riskClass) counts[risk.riskClass] += 1;
  return counts;
}

const upperRiskRef = (ref: string) => ref.replace(/^\s*risco\b/i, "RISCO");

function gesDisplayTitle(title: string): string {
  let rest = title.trim();
  const duplicated = /^GES\s*(\d+)\s*-?\s*GES(?![A-ZÀ-Ý])\s*(\d*)\s*-?\s*(.*)$/i;
  for (let m = rest.match(duplicated); m; m = rest.match(duplicated)) {
    rest = `GES ${m[2] || m[1]} - ${m[3]}`.trim();
  }
  const match = rest.match(/^GES\s*(\d+)\s*-?\s*(.*)$/i);
  if (!match) return rest;
  const number = match[1].padStart(2, "0");
  return match[2] ? `GES ${number} - ${match[2]}` : `GES ${number}`;
}

const emptyMeasurement = (criterion: string) =>
  criterion === "Qualitativo" ? "Não aplicável" : "Não informado";

function measureLevel(level: PgrDocxMeasureLevel): PgrDocxMeasureLevel {
  const glued = glueFields(level, {
    measures: MEASURE_TEXT_WIDTH,
    monitoring: MEASURE_MONITORING_WIDTH,
  });
  return {
    ...glued,
    monitoring: level.monitoring.trim() === "" ? "Não informado" : glued.monitoring,
  };
}

function riskUnit(risk: PgrDocxRisk): Pick<PgrDocxRisk, "unitLabel" | "unitValue"> {
  if (risk.agentKey !== "ergonomic" && risk.agentKey !== "psychosocial") {
    return { unitLabel: risk.unitLabel, unitValue: risk.unitValue };
  }
  const ergonomicGroup = "GRUPO DE RISCO ERGONÔMICO:";
  const keepsValue =
    risk.unitLabel.trim() === ergonomicGroup && risk.unitValue.trim() !== "";
  return {
    unitLabel: ergonomicGroup,
    unitValue: keepsValue ? risk.unitValue : "Não informado",
  };
}

function buildGes(ges: PgrDocxGes) {
  const counts = countRisksByClass(ges.risks);
  return {
    ...ges,
    title: gesDisplayTitle(ges.title),
    processDescription: keepLastWords(ges.processDescription.trim()) || "Não informado",
    construction: buildConstruction(ges.construction),
    risks: ges.risks.map((risk) => ({
      ...glueFields(risk, {
        hazard: RISK_CARD_WIDTH,
        risk: RISK_CARD_WIDTH,
        sources: RISK_CARD_WIDTH,
        propagation: RISK_CARD_WIDTH,
        exposureTime: RISK_CARD_WIDTH,
        injuries: RISK_CARD_WIDTH,
        severity: RISK_CARD_WIDTH,
        controlNeed: RISK_CARD_WIDTH,
        probability: RISK_CARD_WIDTH,
        uncertainty: RISK_CARD_WIDTH,
      }),
      ...riskUnit(risk),
      result: risk.result.trim() || emptyMeasurement(risk.criterion),
      toleranceLimit: risk.toleranceLimit.trim() || emptyMeasurement(risk.criterion),
      agent: { [risk.agentKey]: true },
      level: riskClassFlags(risk.riskClass),
    })),
    measures: ges.measures.map((measure) => ({
      ...measure,
      riskLabel: upperRiskRef(measure.riskLabel),
      riskName: balanceTableText(measure.riskName, MEASURE_RISK_WIDTH),
      elimination: measureLevel(measure.elimination),
      collective: measureLevel(measure.collective),
      administrative: measureLevel(measure.administrative),
      individual: measureLevel(measure.individual),
    })),
    epis: ges.epis.map((epi) => ({
      ...glueFields(epi, { hazard: EPI_HAZARD_WIDTH, epi: EPI_NAME_WIDTH }),
      riskRef: upperRiskRef(epi.riskRef),
    })),
    actions: ges.actions.map((action) => ({
      ...glueFields(action, {
        occupationalRisk: ACTION_FIELD_WIDTH,
        action: ACTION_FIELD_WIDTH,
        tracking: ACTION_FIELD_WIDTH,
        measurement: ACTION_FIELD_WIDTH,
        responsible: ACTION_FIELD_WIDTH,
      }),
      riskRef: upperRiskRef(action.riskRef),
    })),
    dashboard: {
      total: String(ges.risks.length),
      ...mapRecord(counts, (count) => String(count)),
    },
  };
}

export type PgrDocxTemplateData = ReturnType<typeof buildPgrDocxData>;

export function buildPgrDocxData(
  content: PgrDocxContent,
  options: PgrDocxBuildOptions = {},
) {
  const { overrides = {}, annotate = false } = options;
  const semiShading = annotate ? PGR_DOCX_ANNOTATION.semiFixed : undefined;
  const company = {
    ...content.company,
    razaoSocial: upper(content.company.razaoSocial),
    nomeFantasia: upper(content.company.nomeFantasia),
    cityState: upper(content.company.cityState),
    address: upper(content.company.address),
  };
  const workUnit = { ...content.workUnit, name: upper(content.workUnit.name) };

  const labels = { ...DEFAULT_LABELS, ...defined(overrides.labels) } as Record<
    PgrDocxLabelKey,
    string
  >;
  const cipaGrade = (content.cipa?.riskGrade || company.riskGrade).trim();
  const employeeCount =
    [content.jobRolesTotal, content.cipa?.employeeCount]
      .map((value) => value?.trim() ?? "")
      .find((value) => value !== "" && value !== "0" && !value.startsWith("{{")) ?? "";
  const cipaMembers = Boolean(
    content.cipa?.effectiveMembers?.trim() && content.cipa?.alternateMembers?.trim(),
  );
  const cipaSingular = {
    effective: content.cipa?.effectiveMembers?.trim() === "1",
    alternate: content.cipa?.alternateMembers?.trim() === "1",
  };
  const cipaHours =
    content.cipa?.trainingHours?.trim() || CIPA_TRAINING_HOURS[cipaGrade] || "";
  const bands = content.classificationBands;
  const ranges = riskBandRanges(bands);
  const matrix = riskBandMatrix(bands);
  const exampleClass = riskMatrixClass(matrix, 2, 3);
  const symmetricExample = exampleClass === riskMatrixClass(matrix, 3, 2);
  const tokens: Record<string, string> = {
    empresa: company.razaoSocial,
    grauRisco: cipaGrade,
    numeroEmpregados: employeeCount || "—",
    cipaTitulares: withNumberWord(content.cipa?.effectiveMembers || "—"),
    cipaSuplentes: withNumberWord(content.cipa?.alternateMembers || "—"),
    cipaHorasTreinamento: withNumberWord(cipaHours || "—"),
    anosVigencia: content.validityYears ?? validityYears(content.validity),
    faixaTrivial: ranges.trivial,
    faixaToleravel: ranges.tolerable,
    faixaModerado: ranges.moderate,
    faixaSubstancial: ranges.substantial,
    faixaIntoleravel: ranges.intolerable,
    classeExemplo:
      PGR_DOCX_RISK_CLASS_COLORS[exampleClass].label.toLocaleLowerCase("pt-BR"),
  };

  const titles = mapRecord(
    { ...DEFAULT_TITLES, ...defined(overrides.titles) } as Record<
      PgrDocxTitleKey,
      string
    >,
    (title) => withoutEmptyParentheses(fillTokens(title, tokens)),
  );
  const texts = mapRecord(
    DEFAULT_TEXTS as Record<PgrDocxTextKey, RichBlock[]>,
    (blocks, key) => {
      const override = overrides.texts?.[key];
      const source =
        override === undefined
          ? blocks
          : typeof override === "string"
            ? plainTextToBlocks(override)
            : override;
      return richTextToOoxml(
        source
          .filter((block) => !(symmetricExample && block === RISK_MATRIX_ASYMMETRY_NOTE))
          .map((block) => ({
            ...block,
            text: fillTokens(
              withSingularCipaMembers(
                withoutMissingCipaData(block.text, {
                  grade: cipaGrade !== "",
                  employees: employeeCount !== "",
                  members: cipaMembers,
                  hours: cipaHours !== "",
                }),
                cipaSingular,
              ),
              tokens,
            ),
          })),
        { shading: semiShading, keepLastWithNext: key === "riskCategoryExample" },
      );
    },
  );
  const methodology: PgrDocxMethodology = {
    ...DEFAULT_METHODOLOGY,
    ...defined(overrides.methodology),
  };
  const campaigns = overrides.campaigns ?? DEFAULT_CAMPAIGNS;

  return {
    labels: {
      ...labels,
      controlNeedPriority: balanceTableText(
        labels.controlNeedPriority,
        CONTROL_NEED_PRIORITY_WIDTH,
        true,
      ),
    },
    cover: buildCoverXml(
      {
        validity: content.validity,
        razaoSocial: company.razaoSocial,
        nomeFantasia: company.nomeFantasia,
        cityState: company.cityState,
        workUnit: workUnit.name,
        contractNumbers: workUnit.contractNumbers,
        labels: { validity: labels.validity, contract: labels.contract },
      },
      { annotate, labelShading: PGR_DOCX_ANNOTATION.semiFixed },
    ),
    titles,
    texts,
    summary: SUMMARY_ORDER.map((key) => ({ title: titles[key] })),
    emittedAt: content.emittedAt,
    validity: content.validity,
    company,
    workUnit,
    workUnitAddressXml: workUnitAddressXml(workUnit),
    contract: {
      ...content.contract,
      hasAny: Object.values(content.contract).some((value) => value.trim() !== ""),
    },
    responsibles: content.responsibles,
    revisions: content.revisions.map((revision) => ({
      ...revision,
      description: glueLastWords(revision.description, REVISION_DESCRIPTION_WIDTH),
      responsible: glueLastWords(revision.responsible, REVISION_RESPONSIBLE_WIDTH),
    })),
    jobRoles: content.jobRoles.map((role) => {
      const name = balanceTableText(role.name, JOB_ROLE_NAME_WIDTH, true);
      const description = glueLastWords(role.description, JOB_ROLE_DESCRIPTION_WIDTH);
      const workload = balanceTableText(
        keepWorkloadTogether(role.workload),
        JOB_ROLE_WORKLOAD_WIDTH,
      );
      const lines = Math.max(
        estimatedLines(name, JOB_ROLE_NAME_WIDTH, true),
        estimatedLines(description, JOB_ROLE_DESCRIPTION_WIDTH),
        estimatedLines(workload, JOB_ROLE_WORKLOAD_WIDTH),
      );
      return {
        ...role,
        name,
        description,
        workload,
        parts: jobRoleParts(
          { name, description, workload, employeeCount: role.employeeCount },
          {
            keepWhole: lines <= KEEP_WHOLE_MAX_LINES,
            descriptionWidth: JOB_ROLE_DESCRIPTION_WIDTH - TABLE_CELL_MARGIN,
            firstMinLines: Math.max(
              wrapLines(name, JOB_ROLE_NAME_WIDTH - TABLE_CELL_MARGIN, true).length,
              wrapLines(workload, JOB_ROLE_WORKLOAD_WIDTH - TABLE_CELL_MARGIN).length,
            ),
          },
        ).map((part) => ({
          ...part,
          descriptionXml: jobRoleDescriptionXml(part.description),
        })),
      };
    }),
    jobRolesTotal:
      content.jobRolesTotal.trim() || (content.jobRoles.length === 0 ? "0" : ""),
    methodology: {
      ...methodology,
      controlNeed: mapRecord(methodology.controlNeed, (fields) =>
        mapRecord(fields, (text) => balanceTableText(text, CONTROL_NEED_CELL_WIDTH)),
      ),
    },
    riskLevelLabels: riskLevelLabels(bands),
    trainingMatrixXml: trainingMatrixXml(content.trainingMatrix, {
      index: labels.trainingIndex,
      role: labels.trainingRole,
      empty: labels.trainingMatrixEmpty,
    }),
    riskMatrixXml: riskMatrixXml(
      methodology.matrix,
      {
        probability: labels.matrixProbability,
        severity: labels.matrixSeverity,
        legend: labels.matrixLegend,
      },
      { matrix, ranges },
    ),
    campaignsXml: campaignsXml(
      campaigns,
      { actions: labels.campaignActions },
      { shading: semiShading },
    ),
    ges: content.ges.map(buildGes),
    machines: content.machines ?? [],
    hasMachines: (content.machines?.length ?? 0) > 0,
    annexActions: content.ges.flatMap((ges) =>
      ges.actions.map((action) => ({
        gesTitle: balanceTableText(
          gesDisplayTitle(ges.title).replace(/ - /g, `${NBSP}- `),
          ANNEX_GES_WIDTH,
          true,
        ),
        riskRef: upperRiskRef(action.riskRef),
        occupationalRisk: glueLastWords(
          balanceTableText(action.occupationalRisk, ANNEX_RISK_WIDTH),
          ANNEX_RISK_WIDTH,
        ),
        action: glueLastWords(action.action, ANNEX_ACTION_WIDTH),
        responsible: glueLastWords(
          balanceTableText(action.responsible, ANNEX_RESPONSIBLE_WIDTH),
          ANNEX_RESPONSIBLE_WIDTH,
        ),
        deadline: action.deadline,
        status: action.status,
      })),
    ),
  };
}
