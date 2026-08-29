import { z } from "zod";

import { optionalString, optionalIsoDate } from "./form-fields";
import { controlLevelSchema, controlLevelLabel, type ControlLevel } from "./risks";
import type { RiskClassification } from "./methodology";

/**
 * Domínio puro das medidas de controle — plano de ação 5W2H por nível NR-01 (issue #26).
 * Espelha as colunas de `control_measures` (schema `db/schema/risks.ts`, migration `0012`)
 * em Zod. O **estado** (`Sem plano`/`Planejada`/`Vencida`, `MeasureState`) é **derivado** na
 * leitura — não tem coluna própria. Já o **status** (`maintain`/`introduced`/`improved`,
 * `ControlMeasureStatus`, coluna `status` da migration `0031`) É persistido — preenchido pela
 * regra de negócio do nível do risco pai (issue #42, ver `defaultMeasureStatusForClassification`
 * e o repositório). `control_level` é imutável no update (identidade da medida no risco); a
 * UNIQUE `(org_id, risk_id, control_level)` faz a duplicidade de nível virar `DUPLICATE`/409 na
 * camada de erro.
 */

export type { ControlMeasure, Risk, RiskAssessment } from "@/shared/db/schema/risks";
export { controlLevelSchema, controlLevelLabel };
export type { ControlLevel };

// ---------------------------------------------------------------------------
// `applicable` robusto: aceita boolean (REST JSON) e string de formulário.
// `z.coerce.boolean("false") === true` (qualquer string não vazia é truthy) — bug. Por isso
// usamos um preprocess explícito. Ausente/desconhecido → false.
// ---------------------------------------------------------------------------
const TRUTHY = new Set(["true", "on", "1", "yes"]);
const applicableField = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return TRUTHY.has(value.trim().toLowerCase());
  return false;
}, z.boolean());

// ---------------------------------------------------------------------------
// Status da medida (issue #42): mantida/introduzida/melhorada. Opcional na entrada — quando
// ausente, o repositório (`db/repositories/control-measures.ts`) preenche um default a partir
// da classificação vigente do risco pai (ver `defaultMeasureStatusForClassification` abaixo).
// Fica FORA do superRefine porque depende de dado externo (avaliação de risco), que o Zod puro
// não enxerga — a validação condicional a isso vive no repositório (única camada que já lê o
// risco pai dentro da mesma transação).
// ---------------------------------------------------------------------------
export const controlMeasureStatusSchema = z.enum(["maintain", "introduced", "improved"]);
export type ControlMeasureStatus = z.infer<typeof controlMeasureStatusSchema>;

/** Como `optionalIsoDate`/`optionalUrl`: string vazia (form) → undefined; senão valida o enum. */
const optionalStatusField = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  controlMeasureStatusSchema.nullish(),
);

const MEASURE_STATUS_LABELS: Record<ControlMeasureStatus, string> = {
  maintain: "Manter",
  introduced: "Introduzida",
  improved: "Melhorada",
};

export function measureStatusLabel(status: ControlMeasureStatus): string {
  return MEASURE_STATUS_LABELS[status];
}

/** Níveis de risco moderado+ (moderado/substancial/intolerável) — exigem 5W2H completo (#42). */
const MODERATE_PLUS_CLASSIFICATIONS = new Set<RiskClassification>([
  "moderate",
  "substantial",
  "intolerable",
]);

export function isModeratePlusClassification(
  classification: RiskClassification | null,
): boolean {
  return classification !== null && MODERATE_PLUS_CLASSIFICATIONS.has(classification);
}

/**
 * Status default da medida a partir da classificação vigente do risco pai (#42):
 * trivial/tolerável → "maintain"; moderado+ → "introduced". Sem avaliação vigente
 * (`classification === null`) não há default — não existe nível para basear a regra, o
 * campo permanece como veio (tipicamente `null`).
 */
export function defaultMeasureStatusForClassification(
  classification: RiskClassification | null,
): ControlMeasureStatus | null {
  if (classification === null) return null;
  return isModeratePlusClassification(classification) ? "introduced" : "maintain";
}

// ---------------------------------------------------------------------------
// Schema de entrada (create E update — corpo completo). Não inclui `id`/`orgId`/`riskId`
// (orgId vem da sessão; riskId vem da rota). No update, `controlLevel` é ignorado na escrita.
// ---------------------------------------------------------------------------
export const controlMeasureInputSchema = z
  .object({
    controlLevel: controlLevelSchema,
    applicable: applicableField,
    status: optionalStatusField,
    justification: optionalString,
    monitoring: optionalString,
    actionWhat: optionalString,
    actionHow: optionalString,
    actionTracking: optionalString,
    actionMeasurement: optionalString,
    actionResponsible: optionalString,
    actionDeadline: optionalIsoDate,
  })
  .superRefine((values, ctx) => {
    // Campos mínimos do plano: obrigatórios apenas quando a medida é aplicável (FR-004).
    if (values.applicable && !values.actionWhat) {
      ctx.addIssue({
        code: "custom",
        path: ["actionWhat"],
        message: "Descreva a ação (o quê) quando a medida for aplicável",
      });
    }
    if (values.applicable && !values.actionHow) {
      ctx.addIssue({
        code: "custom",
        path: ["actionHow"],
        message: "Descreva a ação (como) quando a medida for aplicável",
      });
    }
  });

export type ControlMeasureInput = z.input<typeof controlMeasureInputSchema>;
export type ControlMeasureValues = z.output<typeof controlMeasureInputSchema>;
/** O repositório grava exatamente a saída validada (não há derivados no servidor). */
export type ControlMeasureWriteValues = ControlMeasureValues;

// ---------------------------------------------------------------------------
// Estados derivados (não persistidos)
// ---------------------------------------------------------------------------

export const MEASURE_STATES = ["without_plan", "planned", "overdue"] as const;
export type MeasureState = (typeof MEASURE_STATES)[number];

const MEASURE_STATE_LABELS: Record<MeasureState, string> = {
  without_plan: "Sem plano",
  planned: "Planejada",
  overdue: "Vencida",
};

export function measureStateLabel(state: MeasureState): string {
  return MEASURE_STATE_LABELS[state];
}

/**
 * Vencida ⇔ aplicável **e** com prazo **e** prazo anterior a `today`. `actionDeadline` e `today`
 * são strings `AAAA-MM-DD` (coluna `date`); a comparação lexicográfica equivale à cronológica.
 * `today` é **parâmetro** (o caller passa a data local, fuso `America/Sao_Paulo`) → função pura.
 */
export function isOverdue(
  applicable: boolean,
  actionDeadline: string | null,
  today: string,
): boolean {
  return applicable && actionDeadline != null && actionDeadline < today;
}

/** Estado derivado da medida (sem coluna de status). */
export function deriveMeasureState(
  measure: { applicable: boolean; actionDeadline: string | null },
  today: string,
): MeasureState {
  if (!measure.applicable) return "without_plan";
  if (isOverdue(measure.applicable, measure.actionDeadline, today)) return "overdue";
  return "planned";
}

// ---------------------------------------------------------------------------
// Projeção de leitura (list). `actionDeadline` é string ("AAAA-MM-DD"); `createdAt` é Date
// (coluna `timestamp` → Drizzle retorna objeto Date). Sem campo de estado (derivado na UI).
// ---------------------------------------------------------------------------
export type ControlMeasureListItem = {
  id: string;
  controlLevel: ControlLevel;
  applicable: boolean;
  status: ControlMeasureStatus | null;
  justification: string | null;
  monitoring: string | null;
  actionWhat: string | null;
  actionHow: string | null;
  actionTracking: string | null;
  actionMeasurement: string | null;
  actionResponsible: string | null;
  actionDeadline: string | null;
  createdAt: Date;
};
