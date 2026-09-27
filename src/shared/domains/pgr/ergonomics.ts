import { z } from "zod";

import { optionalString } from "./form-fields";

/**
 * Domínio puro da avaliação ergonômica (NR-17) — issue #40.
 *
 * Só regras e vocabulário: quais são as seis dimensões, como se chamam em pt-BR, o
 * que significa cada estado de adequação e qual avaliação é a **vigente**. Nada aqui
 * diagnostica: **não existe conclusão geral**, escore, escala numérica nem checklist
 * normativo inventado — a NR-17 não fixa nenhum deles, e o sistema não cria norma.
 */

// ---------------------------------------------------------------------------
// Adequação por dimensão
// ---------------------------------------------------------------------------

export const ERGONOMIC_ADEQUACIES = ["adequate", "inadequate", "not_applicable"] as const;
export type ErgonomicAdequacy = (typeof ERGONOMIC_ADEQUACIES)[number];

export const ergonomicAdequacySchema = z.enum(ERGONOMIC_ADEQUACIES, {
  error: "Adequação inválida",
});

const ADEQUACY_LABELS: Record<ErgonomicAdequacy, string> = {
  adequate: "Adequado",
  inadequate: "Inadequado",
  not_applicable: "Não aplicável",
};

/** Rótulo do estado declarado. Para ausência de avaliação use `NOT_ASSESSED_LABEL`. */
export function ergonomicAdequacyLabel(value: ErgonomicAdequacy): string {
  return ADEQUACY_LABELS[value];
}

/**
 * Dimensão **não avaliada** (`null`). Distinto de `not_applicable`, que é uma
 * declaração do profissional. Nenhum dos dois pode virar "Adequado".
 */
export const NOT_ASSESSED_LABEL = "Não avaliado";

/** Rótulo tolerante a `null`/`undefined` — o que a tela e o PDF imprimem. */
export function ergonomicAdequacyText(
  value: ErgonomicAdequacy | null | undefined,
): string {
  return value ? ADEQUACY_LABELS[value] : NOT_ASSESSED_LABEL;
}

/** Tom do `StatusBadge` (kit `data-list`) — nenhuma cor nova, nenhum hex solto. */
export function ergonomicAdequacyTone(
  value: ErgonomicAdequacy | null | undefined,
): "green" | "red" | "neutral" {
  if (value === "adequate") return "green";
  if (value === "inadequate") return "red";
  return "neutral";
}

// ---------------------------------------------------------------------------
// As seis dimensões
// ---------------------------------------------------------------------------

export const ERGONOMIC_DIMENSIONS = [
  "posture",
  "movements",
  "physicalLoad",
  "mentalLoad",
  "workOrganization",
  "physicalEnvironment",
] as const;
export type ErgonomicDimension = (typeof ERGONOMIC_DIMENSIONS)[number];

const DIMENSION_LABELS: Record<ErgonomicDimension, string> = {
  posture: "Postura",
  movements: "Movimentos",
  physicalLoad: "Carga física",
  mentalLoad: "Carga mental",
  workOrganization: "Organização do trabalho",
  physicalEnvironment: "Ambiente físico",
};

export function ergonomicDimensionLabel(dimension: ErgonomicDimension): string {
  return DIMENSION_LABELS[dimension];
}

/** Campo de observação correspondente a cada dimensão (`posture` → `postureNotes`). */
export function ergonomicDimensionNotesKey(
  dimension: ErgonomicDimension,
): `${ErgonomicDimension}Notes` {
  return `${dimension}Notes` as const;
}

/**
 * Agrupamento usado pelo formulário e pelo PDF: aspectos físicos × aspectos mentais e
 * organizacionais. É só apresentação — não muda a semântica de nenhuma dimensão.
 */
export const ERGONOMIC_DIMENSION_GROUPS: {
  title: string;
  dimensions: ErgonomicDimension[];
}[] = [
  {
    title: "Aspectos físicos",
    dimensions: ["posture", "movements", "physicalLoad", "physicalEnvironment"],
  },
  {
    title: "Aspectos mentais e organizacionais",
    dimensions: ["mentalLoad", "workOrganization"],
  },
];

/**
 * Métodos/instrumentos sugeridos na UI (datalist). Lista **aberta**: a NR-17 não fixa
 * instrumento, e fechar o conjunto excluiria método legítimo. "COPSOQ" aparece como
 * texto que o profissional informa — o sistema **não** implementa a metodologia e
 * nunca calcula escore a partir dela.
 */
export const ERGONOMIC_METHOD_SUGGESTIONS = [
  "AEP — inspeção do posto de trabalho",
  "Checklist de Couto",
  "RULA",
  "REBA",
  "Equação de NIOSH",
  "Moore-Garg (strain index)",
  "Entrevista com os trabalhadores",
  "COPSOQ",
] as const;

/**
 * `doc_type` sugerido para o laudo de **AET** anexado ao risco pelo GED. A AET não vira
 * tabela nem formulário: é documento, e o acervo já versiona documento desde a #56.
 */
export const AET_DOC_TYPE = "Análise Ergonômica do Trabalho (AET)";

// ---------------------------------------------------------------------------
// Schema de entrada (create E update — corpo completo)
// ---------------------------------------------------------------------------

const optionalAdequacy = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  ergonomicAdequacySchema.optional(),
);

const optionalNotes = optionalString;

/** Texto curto opcional com limite (`""` → `undefined`). */
function optionalCapped(max: number, message: string) {
  return z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? undefined : value))
    .optional();
}

const UUID_FORMAT =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Campanha psicossocial opcional; vazio → `undefined` (sem vínculo). */
const optionalCampaignId = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().regex(UUID_FORMAT, "Campanha psicossocial inválida").optional(),
);

/**
 * Entrada da avaliação ergonômica. **Nenhuma dimensão é obrigatória** — uma avaliação
 * parcial é válida e continua honesta (o que não foi avaliado aparece como "não
 * avaliado", nunca como conformidade). Só a data é exigida, porque é ela que define a
 * vigência. `riskId` vem da rota e `orgId` da sessão — nunca do cliente.
 */
export const ergonomicEvaluationInputSchema = z.object({
  assessedAt: z.iso.date("Data da avaliação inválida (use AAAA-MM-DD)"),
  responsible: optionalCapped(255, "Responsável muito longo"),
  method: optionalCapped(255, "Método muito longo"),
  psychosocialCampaignId: optionalCampaignId,
  notes: optionalNotes,

  posture: optionalAdequacy,
  postureNotes: optionalNotes,
  movements: optionalAdequacy,
  movementsNotes: optionalNotes,
  physicalLoad: optionalAdequacy,
  physicalLoadNotes: optionalNotes,
  mentalLoad: optionalAdequacy,
  mentalLoadNotes: optionalNotes,
  workOrganization: optionalAdequacy,
  workOrganizationNotes: optionalNotes,
  physicalEnvironment: optionalAdequacy,
  physicalEnvironmentNotes: optionalNotes,
});

export type ErgonomicEvaluationInput = z.input<typeof ergonomicEvaluationInputSchema>;
export type ErgonomicEvaluationValues = z.output<typeof ergonomicEvaluationInputSchema>;

// ---------------------------------------------------------------------------
// Vigência
// ---------------------------------------------------------------------------

/** Forma mínima para decidir vigência (serve à linha do banco e a DTOs). */
export type ErgonomicEvaluationOrder = {
  id: string;
  assessedAt: string;
  createdAt: Date | string;
};

function createdAtMillis(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * Ordem canônica do histórico: `assessed_at` desc, desempate por `created_at` desc e,
 * em último caso, `id` desc. Determinística — duas avaliações no mesmo dia e no mesmo
 * instante ainda produzem sempre a mesma "vigente". **Única** definição da regra; o
 * repositório ordena com o mesmo critério em SQL e o consolidado reusa daqui.
 */
export function compareErgonomicEvaluations(
  a: ErgonomicEvaluationOrder,
  b: ErgonomicEvaluationOrder,
): number {
  if (a.assessedAt !== b.assessedAt) return a.assessedAt < b.assessedAt ? 1 : -1;
  const diff = createdAtMillis(b.createdAt) - createdAtMillis(a.createdAt);
  if (diff !== 0) return diff;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/** Avaliação vigente de uma lista (a mais recente). `null` quando não há nenhuma. */
export function currentErgonomicEvaluation<T extends ErgonomicEvaluationOrder>(
  evaluations: readonly T[],
): T | null {
  if (evaluations.length === 0) return null;
  return [...evaluations].sort(compareErgonomicEvaluations)[0];
}

// ---------------------------------------------------------------------------
// Leitura / apresentação
// ---------------------------------------------------------------------------

/** Estado honesto quando o risco não tem nenhuma avaliação ergonômica registrada. */
export const NO_ERGONOMIC_EVALUATION_LABEL = "Sem avaliação ergonômica registrada";

/** Valores das seis dimensões (o que a tela/PDF percorre). */
export type ErgonomicDimensionValues = {
  [K in ErgonomicDimension]?: ErgonomicAdequacy | null;
} & {
  [K in `${ErgonomicDimension}Notes`]?: string | null;
};

export type ErgonomicDimensionEntry = {
  dimension: ErgonomicDimension;
  label: string;
  adequacy: ErgonomicAdequacy | null;
  notes: string | null;
};

/** Lista as seis dimensões na ordem canônica, com rótulo, estado e observação. */
export function listErgonomicDimensions(
  evaluation: ErgonomicDimensionValues,
): ErgonomicDimensionEntry[] {
  return ERGONOMIC_DIMENSIONS.map((dimension) => ({
    dimension,
    label: DIMENSION_LABELS[dimension],
    adequacy: evaluation[dimension] ?? null,
    notes: evaluation[ergonomicDimensionNotesKey(dimension)] ?? null,
  }));
}

/**
 * Quantas dimensões foram declaradas inadequadas. É **contagem**, não diagnóstico: não
 * vira nota, nível nem conclusão — serve só para destacar a avaliação na lista.
 */
export function countInadequateDimensions(evaluation: ErgonomicDimensionValues): number {
  return ERGONOMIC_DIMENSIONS.filter((d) => evaluation[d] === "inadequate").length;
}

/** Quantas dimensões foram efetivamente avaliadas (qualquer estado declarado). */
export function countAssessedDimensions(evaluation: ErgonomicDimensionValues): number {
  return ERGONOMIC_DIMENSIONS.filter((d) => evaluation[d] != null).length;
}

/** Resumo textual "3 de 6 avaliadas · 1 inadequada" para a lista/histórico. */
export function summarizeErgonomicDimensions(
  evaluation: ErgonomicDimensionValues,
): string {
  const assessed = countAssessedDimensions(evaluation);
  const inadequate = countInadequateDimensions(evaluation);
  if (assessed === 0) return "Nenhuma dimensão avaliada";
  const base = `${assessed} de ${ERGONOMIC_DIMENSIONS.length} avaliadas`;
  if (inadequate === 0) return base;
  return `${base} · ${inadequate} inadequada${inadequate > 1 ? "s" : ""}`;
}

// ---------------------------------------------------------------------------
// Bloco agregado da campanha psicossocial (decisão Q3 = A)
// ---------------------------------------------------------------------------

/**
 * O que o PGR pode mostrar de uma campanha vinculada: **apenas agregado**. Nenhuma
 * resposta individual, nenhum identificador de participante (as respostas nem sequer
 * têm vínculo com pessoa no modelo) e nenhum escore normativo.
 */
export type PsychosocialAggregate = {
  campaignId: string;
  name: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  responseCount: number;
  factors: { factor: string; level: number }[];
};

/**
 * Rótulo do bloco no documento. Declara o que o dado é — resultado agregado de uma
 * campanha do próprio sistema — e **nunca** "escore COPSOQ": a metodologia oficial não
 * está implementada e afirmar o contrário num documento legal seria falso.
 */
export const PSYCHOSOCIAL_AGGREGATE_LABEL = "Resultado agregado da campanha psicossocial";

/** Período "01/01/2026 a 31/03/2026"; `null` quando a campanha não tem datas. */
export function formatCampaignPeriod(
  startsAt: string | null,
  endsAt: string | null,
): string | null {
  if (!startsAt && !endsAt) return null;
  if (startsAt && endsAt) return `${startsAt} a ${endsAt}`;
  return startsAt ? `a partir de ${startsAt}` : `até ${endsAt}`;
}
