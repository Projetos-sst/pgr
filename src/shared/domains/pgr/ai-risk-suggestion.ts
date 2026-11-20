import { z } from "zod";

import { aliasPreprocessor } from "./enum-aliases";
import { riskInputSchema, type RiskValues } from "./risk";
import {
  exposureTimeSchema,
  riskAgentTypeSchema,
  type ExposureTime,
  type RiskAgentType,
} from "./risks";

/**
 * Domínio puro da sugestão de riscos por IA. Espelha o **subconjunto** de `risks`
 * que o LLM preenche (agente, perigo, descrição, fontes, propagação, lesões, exposição) e mapeia a sugestão
 * aceita para um rascunho de risco reutilizando `riskInputSchema`. Sem acesso a
 * banco nem ao provedor de IA — só regras/validação (testável isoladamente).
 */

/** `kind` gravado em `ai_usage_events` para o rate limiting por organização. */
export const AI_RISK_SUGGESTION_KIND = "risk_suggestion";

/** Teto de itens por rodada de sugestão (protege contexto e UI). */
export const MAX_SUGGESTIONS = 12;

/** `null`/`""`/espaços → `undefined`; senão string não-vazia. Robusto à saída do LLM. */
const optionalText = z.preprocess(
  (v) => (v == null || (typeof v === "string" && v.trim() === "") ? undefined : v),
  z.string().trim().min(1).optional(),
);

/**
 * Sinônimos aceitos para o grupo do agente. O prompt pede o valor em inglês (o enum do
 * banco), mas a conversa toda acontece em português e o modelo às vezes responde
 * `"Físico"`, `"risco químico"` ou o plural. Sem este mapa, o Zod rejeitava **item a
 * item** e uma resposta inteira e correta virava lista vazia — indistinguível, na tela, de
 * "a IA não encontrou nada".
 */
const AGENT_TYPE_ALIASES: Record<string, RiskAgentType> = {
  fisico: "physical",
  fisicos: "physical",
  quimico: "chemical",
  quimicos: "chemical",
  biologico: "biological",
  biologicos: "biological",
  ergonomico: "ergonomic",
  ergonomicos: "ergonomic",
  mecanico: "mechanical",
  mecanicos: "mechanical",
  acidente: "accident",
  acidentes: "accident",
  psicossocial: "psychosocial",
  psicossociais: "psychosocial",
  "fatores psicossociais": "psychosocial",
};

/** Prefixos de ruído que o modelo anexa ao grupo: "risco físico", "agente químico". */
const AGENT_TYPE_NOISE = /^(risco|agente|riscos|agentes)\s+/;

/** Grupo do agente tolerante a pt-BR; valor irreconhecível segue para o enum reprovar. */
export const normalizeAgentType = aliasPreprocessor(AGENT_TYPE_ALIASES, AGENT_TYPE_NOISE);

const EXPOSURE_TIME_ALIASES: Record<string, ExposureTime> = {
  eventual: "eventual",
  intermitente: "intermittent",
  habitual: "habitual",
  "habitual e permanente": "habitual",
  permanente: "habitual",
  continuo: "habitual",
  "menos de 1h": "lt_1h",
  "< 1h": "lt_1h",
  "1 a 2h": "1_2h",
  "2 a 4h": "2_4h",
  "4 a 7h": "4_7h",
  "mais de 7h": "gt_7h",
  "> 7h": "gt_7h",
};

const EXPOSURE_TIME_NOISE = /^(exposicao|tempo de exposicao)\s+/;

const normalizeExposureTime = aliasPreprocessor(
  EXPOSURE_TIME_ALIASES,
  EXPOSURE_TIME_NOISE,
);

const optionalExposureTime = z.preprocess(
  (v) =>
    v == null || (typeof v === "string" && v.trim() === "")
      ? undefined
      : normalizeExposureTime(v),
  exposureTimeSchema.optional().catch(undefined),
);

/** Um risco sugerido pela IA — só os campos que o modelo produz. */
export const suggestedRiskSchema = z.object({
  agentType: z.preprocess(normalizeAgentType, riskAgentTypeSchema),
  hazard: optionalText,
  description: z.string().trim().min(1, "Descrição é obrigatória"),
  sources: optionalText,
  propagation: optionalText,
  possibleInjuries: optionalText,
  exposureTime: optionalExposureTime,
});

export type SuggestedRisk = z.infer<typeof suggestedRiskSchema>;

/** Entrada da ação de aceite: os riscos selecionados/revisados pelo usuário. */
export const acceptSuggestedRisksInputSchema = z.object({
  suggestions: z.array(suggestedRiskSchema).min(1).max(MAX_SUGGESTIONS),
});

export type AcceptSuggestedRisksInput = z.input<typeof acceptSuggestedRisksInputSchema>;

export const riskFillFocusSchema = z.object({
  agentType: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    riskAgentTypeSchema.optional(),
  ),
  hazard: optionalText,
  description: optionalText,
});

export type RiskFillFocus = z.output<typeof riskFillFocusSchema>;
export type RiskFillFocusInput = z.input<typeof riskFillFocusSchema>;

export type RiskDraft = {
  agentType: string;
  exposureTime: string;
  hazard: string;
  description: string;
  sources: string;
  propagation: string;
  possibleInjuries: string;
};

export type RiskDraftField = keyof RiskDraft;

export const RISK_DRAFT_FIELDS: RiskDraftField[] = [
  "agentType",
  "exposureTime",
  "hazard",
  "description",
  "sources",
  "propagation",
  "possibleInjuries",
];

export function toRiskDraft(s: SuggestedRisk): RiskDraft {
  return {
    agentType: s.agentType,
    exposureTime: s.exposureTime ?? "",
    hazard: s.hazard ?? "",
    description: s.description,
    sources: s.sources ?? "",
    propagation: s.propagation ?? "",
    possibleInjuries: s.possibleInjuries ?? "",
  };
}

export function filledRiskFields(s: SuggestedRisk): RiskDraftField[] {
  const draft = toRiskDraft(s);
  return RISK_DRAFT_FIELDS.filter((field) => draft[field] !== "");
}

export function applyRiskFill(current: RiskDraft, s: SuggestedRisk): RiskDraft {
  const filled = toRiskDraft(s);
  const merged = { ...current };
  for (const field of filledRiskFields(s)) merged[field] = filled[field];
  return merged;
}

/**
 * Contexto **não-PII** do GES enviado ao LLM: processo, ambiente e títulos de
 * função expostos. Nunca inclui `employees` (nome/CPF/dados pessoais).
 */
export type GesRiskContext = {
  name: string;
  processDescription: string | null;
  constructionType: string | null;
  ceilingHeight: string | null;
  floor: string | null;
  roof: string | null;
  lighting: string | null;
  ventilation: string | null;
  otherCharacteristics: string | null;
  roles: { title: string; workerCount: number }[];
};

/**
 * Valida a saída crua do modelo **item a item**: descarta os inválidos (Zod rejeita
 * o item, não o lote) e limita a `MAX_SUGGESTIONS`. Lista vazia é resultado válido
 * (GES com contexto vago → sem sugestões). Aceita `unknown[]` ou `{ risks: [...] }`.
 */
export function parseModelSuggestions(raw: unknown): SuggestedRisk[] {
  const arr = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { risks?: unknown }).risks)
      ? (raw as { risks: unknown[] }).risks
      : null;
  if (!arr) return [];
  const out: SuggestedRisk[] = [];
  for (const item of arr) {
    const parsed = suggestedRiskSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

/**
 * Mapeia uma sugestão aceita para um **rascunho** de risco (`RiskValues`): só os
 * campos da IA + o GES-alvo; avaliação 5×5, controles e campos eSocial ficam
 * vazios para o usuário completar. Reusa `riskInputSchema` como validação final.
 */
export function toRiskValuesFromSuggestion(gesId: string, s: SuggestedRisk): RiskValues {
  return riskInputSchema.parse({
    gesId,
    agentType: s.agentType,
    hazard: s.hazard,
    description: s.description,
    sources: s.sources,
    propagation: s.propagation,
    possibleInjuries: s.possibleInjuries,
    exposureTime: s.exposureTime,
  });
}
