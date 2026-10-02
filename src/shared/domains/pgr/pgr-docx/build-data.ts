import { campaignsXml, riskMatrixXml, trainingMatrixXml } from "./blocks";
import type { PgrDocxContent, PgrDocxGes, PgrDocxRisk } from "./content";
import {
  DEFAULT_CAMPAIGNS,
  DEFAULT_LABELS,
  DEFAULT_METHODOLOGY,
  DEFAULT_TEXTS,
  DEFAULT_TITLES,
  SUMMARY_ORDER,
  type PgrDocxCampaign,
  type PgrDocxLabelKey,
  type PgrDocxMethodology,
  type PgrDocxTextKey,
  type PgrDocxTitleKey,
  type RichBlock,
} from "./defaults";
import { plainTextToBlocks, richTextToOoxml } from "./rich-text";
import { PGR_DOCX_RISK_CLASSES, type PgrDocxRiskClass } from "./theme";

/**
 * Monta o objeto de dados que o docxtemplater aplica sobre o template do PGR: o
 * conteúdo dinâmico (`PgrDocxContent`) + os valores semi-fixos (default ou override do
 * PGR) + os campos derivados (sumário, dashboard por GES, flags de cor, blocos OOXML).
 * Função pura — o mesmo resultado para o mesmo conteúdo, testável sem banco.
 */

/** Cores de fundo da anotação (template anotado = espelho do PGR 2026.1). */
export const PGR_DOCX_ANNOTATION = { fixed: "FFF1A8", semiFixed: "FFD2A6" } as const;

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

function buildGes(ges: PgrDocxGes) {
  const counts = countRisksByClass(ges.risks);
  return {
    ...ges,
    risks: ges.risks.map((risk) => ({
      ...risk,
      agent: { [risk.agentKey]: true },
      level: riskClassFlags(risk.riskClass),
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

  const labels = { ...DEFAULT_LABELS, ...defined(overrides.labels) } as Record<
    PgrDocxLabelKey,
    string
  >;
  const cipaGrade = (content.cipa?.riskGrade || content.company.riskGrade).trim();
  const tokens: Record<string, string> = {
    empresa: content.company.razaoSocial,
    grauRisco: cipaGrade,
    numeroEmpregados: content.cipa?.employeeCount || content.jobRolesTotal,
    cipaTitulares: withNumberWord(content.cipa?.effectiveMembers || "—"),
    cipaSuplentes: withNumberWord(content.cipa?.alternateMembers || "—"),
    cipaHorasTreinamento: withNumberWord(
      content.cipa?.trainingHours || CIPA_TRAINING_HOURS[cipaGrade] || "—",
    ),
    anosVigencia: content.validityYears ?? validityYears(content.validity),
  };

  const titles = mapRecord(
    { ...DEFAULT_TITLES, ...defined(overrides.titles) } as Record<
      PgrDocxTitleKey,
      string
    >,
    (title) => fillTokens(title, tokens),
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
        source.map((block) => ({ ...block, text: fillTokens(block.text, tokens) })),
        { shading: semiShading },
      );
    },
  );
  const methodology: PgrDocxMethodology = {
    ...DEFAULT_METHODOLOGY,
    ...defined(overrides.methodology),
  };
  const campaigns = overrides.campaigns ?? DEFAULT_CAMPAIGNS;

  return {
    labels,
    titles,
    texts,
    summary: SUMMARY_ORDER.map((key) => ({ title: titles[key] })),
    emittedAt: content.emittedAt,
    validity: content.validity,
    company: content.company,
    workUnit: content.workUnit,
    contract: {
      ...content.contract,
      hasAny: Object.values(content.contract).some((value) => value.trim() !== ""),
    },
    responsibles: content.responsibles,
    revisions: content.revisions,
    jobRoles: content.jobRoles,
    jobRolesTotal: content.jobRolesTotal,
    methodology,
    trainingMatrixXml: trainingMatrixXml(content.trainingMatrix, {
      index: labels.trainingIndex,
      role: labels.trainingRole,
      empty: labels.trainingMatrixEmpty,
    }),
    riskMatrixXml: riskMatrixXml(methodology.matrix, {
      probability: labels.matrixProbability,
      severity: labels.matrixSeverity,
      legend: labels.matrixLegend,
    }),
    campaignsXml: campaignsXml(
      campaigns,
      { actions: labels.campaignActions },
      { shading: semiShading },
    ),
    ges: content.ges.map(buildGes),
  };
}
