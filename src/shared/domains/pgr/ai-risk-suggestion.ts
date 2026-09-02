import { z } from "zod";

import { riskInputSchema, type RiskValues } from "./risk";
import { riskAgentTypeSchema, type RiskAgentType } from "./risks";

/**
 * Domínio puro da sugestão de riscos por IA. Espelha o **subconjunto** de `risks`
 * que o LLM preenche (agente, perigo, descrição, fontes) e mapeia a sugestão
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

/**
 * Normaliza o grupo do agente: minúsculas, sem acento, sem o prefixo "risco"/"agente" e
 * sem plural do inglês. Valor irreconhecível passa intacto para o enum reprovar — tolerar
 * forma não pode virar aceitar qualquer coisa.
 */
export function normalizeAgentType(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const key = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(risco|agente|riscos|agentes)\s+/, "")
    .trim();
  return AGENT_TYPE_ALIASES[key] ?? AGENT_TYPE_ALIASES[key.replace(/s$/, "")] ?? key;
}

/** Um risco sugerido pela IA — só os campos que o modelo produz. */
export const suggestedRiskSchema = z.object({
  agentType: z.preprocess(normalizeAgentType, riskAgentTypeSchema),
  hazard: optionalText,
  description: z.string().trim().min(1, "Descrição é obrigatória"),
  sources: optionalText,
});

export type SuggestedRisk = z.infer<typeof suggestedRiskSchema>;

/** Entrada da ação de aceite: os riscos selecionados/revisados pelo usuário. */
export const acceptSuggestedRisksInputSchema = z.object({
  suggestions: z.array(suggestedRiskSchema).min(1).max(MAX_SUGGESTIONS),
});

export type AcceptSuggestedRisksInput = z.input<typeof acceptSuggestedRisksInputSchema>;

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
  });
}
