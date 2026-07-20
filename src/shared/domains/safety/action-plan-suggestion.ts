import { z } from "zod";

import { actionPlanOriginTypeSchema } from "./action-plan-origin";

/**
 * Domínio **puro** da sugestão de plano 5W2H por IA (Fase 06 / US7). Sem acesso a banco nem
 * ao provedor — só a **allowlist não-PII** de entrada (P0 de privacidade) e a validação da
 * saída 5W2H. A regra de sanitização vive aqui uma única vez: o input enviado ao provedor é
 * **construído campo a campo** a partir de uma allowlist, nunca copiado do registro cru (que
 * pode conter nome/CPF/hospital/lesão/testemunhas). Testado por ausência dessas chaves.
 */

/** `kind` gravado em `ai_usage_events` (coluna TEXT → zero migration). */
export const ACTION_PLAN_SUGGESTION_KIND = "action_plan_suggestion";

const MAX_5W2H = 2000;
const clamp = (v: unknown) =>
  typeof v === "string" ? v.trim().slice(0, 800) : undefined;

// ── Input sanitizado (allowlist não-PII, research §7) ────────────────────────────

/**
 * Contexto técnico de um **risco** permitido no prompt: tipo/descrição do risco e ambiente
 * do GES (processo + características físicas + **títulos** de função). Nunca `employees`/PII.
 */
export const riskSuggestionContextSchema = z
  .object({
    kind: z.literal("risk"),
    agentType: z.string().min(1),
    description: z.string().min(1),
    hazard: z.string().optional(),
    sources: z.string().optional(),
    possibleInjuries: z.string().optional(),
    gesName: z.string().optional(),
    processDescription: z.string().optional(),
    environment: z.string().optional(),
    roleTitles: z.array(z.string()).optional(),
  })
  .strict();

/**
 * Versão **anônima e mínima** de um **incidente**: só classificação e circunstâncias técnicas
 * não identificáveis. **Proibido**: nome/employee_id/CPF, hospital, lesão, parte do corpo,
 * agente causador identificável, testemunhas, investigation_notes, CAT, fotos, IDs internos.
 */
export const incidentSuggestionContextSchema = z
  .object({
    kind: z.literal("incident"),
    type: z.string().min(1),
    category: z.string().min(1),
    severity: z.string().min(1),
    location: z.string().optional(),
    description: z.string().optional(),
    causes: z.string().optional(),
    activityProcedure: z.string().optional(),
    responsibleArea: z.string().optional(),
    environmentalImpact: z.string().optional(),
    materialLoss: z.string().optional(),
  })
  .strict();

export const suggestionInputSchema = z.discriminatedUnion("kind", [
  riskSuggestionContextSchema,
  incidentSuggestionContextSchema,
]);
export type SuggestionInput = z.infer<typeof suggestionInputSchema>;

/** Chaves da allowlist por origem — a única superfície que pode chegar ao provedor. */
export const RISK_SUGGESTION_ALLOWED_KEYS = [
  "kind",
  "agentType",
  "description",
  "hazard",
  "sources",
  "possibleInjuries",
  "gesName",
  "processDescription",
  "environment",
  "roleTitles",
] as const;

export const INCIDENT_SUGGESTION_ALLOWED_KEYS = [
  "kind",
  "type",
  "category",
  "severity",
  "location",
  "description",
  "causes",
  "activityProcedure",
  "responsibleArea",
  "environmentalImpact",
  "materialLoss",
] as const;

/**
 * Constrói o input do **risco** campo a campo (allowlist). Recebe um objeto cru arbitrário
 * (mesmo com PII) e devolve **apenas** os campos permitidos, validados por `.strict()`.
 */
export function sanitizeRiskSuggestionContext(
  raw: Record<string, unknown>,
): SuggestionInput {
  const roleTitles = Array.isArray(raw.roleTitles)
    ? (raw.roleTitles as unknown[])
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter((t) => t.length > 0)
    : undefined;
  return riskSuggestionContextSchema.parse({
    kind: "risk",
    agentType: clamp(raw.agentType) ?? "",
    description: clamp(raw.description) ?? "",
    hazard: clamp(raw.hazard),
    sources: clamp(raw.sources),
    possibleInjuries: clamp(raw.possibleInjuries),
    gesName: clamp(raw.gesName),
    processDescription: clamp(raw.processDescription),
    environment: clamp(raw.environment),
    roleTitles: roleTitles && roleTitles.length > 0 ? roleTitles : undefined,
  });
}

/**
 * Constrói o input do **incidente** campo a campo (allowlist anônima). Descarta qualquer
 * campo pessoal/médico presente no objeto cru — só as chaves permitidas sobrevivem.
 */
export function sanitizeIncidentSuggestionContext(
  raw: Record<string, unknown>,
): SuggestionInput {
  return incidentSuggestionContextSchema.parse({
    kind: "incident",
    type: clamp(raw.type) ?? "",
    category: clamp(raw.category) ?? "",
    severity: clamp(raw.severity) ?? "",
    location: clamp(raw.location),
    description: clamp(raw.description),
    causes: clamp(raw.causes),
    activityProcedure: clamp(raw.activityProcedure),
    responsibleArea: clamp(raw.responsibleArea),
    environmentalImpact: clamp(raw.environmentalImpact),
    materialLoss: clamp(raw.materialLoss),
  });
}

// ── Output 5W2H (validado item-a-item) ────────────────────────────────────────

const w = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} é obrigatório`)
    .max(MAX_5W2H, `${label} deve ter no máximo ${MAX_5W2H} caracteres`);

/**
 * Saída 5W2H da IA — **só** os campos que preenchem o formulário de criação de plano.
 * `org_id`/`origin_*`/`status`/timestamps **nunca** vêm da IA (server-only). Resposta
 * inválida do provedor → tratada como indisponibilidade (`AI_UNAVAILABLE`) pelo core.
 */
export const actionPlanSuggestionSchema = z
  .object({
    what: w("O quê"),
    why: w("Por quê"),
    who: w("Quem"),
    where: w("Onde"),
    when: z.iso.date().nullish(),
    how: w("Como"),
    howMuch: z.coerce.number().min(0).nullish(),
    priority: z.coerce.number().int().min(1).max(3).nullish(),
  })
  .strict();
export type ActionPlanSuggestion = z.infer<typeof actionPlanSuggestionSchema>;

/**
 * Valida a saída crua do provedor. Aceita `unknown`/`{ plan: {...} }`; normaliza `null` →
 * `undefined` nos opcionais. Falha de parse não lança aqui — o core decide degradar.
 */
export function parseActionPlanSuggestion(raw: unknown): ActionPlanSuggestion | null {
  const candidate =
    raw && typeof raw === "object" && "plan" in raw
      ? (raw as { plan: unknown }).plan
      : raw;
  const parsed = actionPlanSuggestionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export { actionPlanOriginTypeSchema };
