import { z } from "zod";

import { aliasPreprocessor } from "./enum-aliases";

import { riskClassificationLabel, type RiskClassification } from "./methodology";
import { controlLevelSchema, controlLevelLabel, type ControlLevel } from "./risks";
import type { ControlMeasureValues } from "./control-measure";

/**
 * Domínio puro da **sugestão de medidas de controle por IA**. Espelha o subconjunto de
 * `control_measures` que o LLM preenche e mapeia a medida aceita para
 * `ControlMeasureValues`. Sem acesso a banco nem ao provedor — só regras/validação.
 *
 * Complementa a sugestão de riscos: lá a IA diz *o que ameaça*, aqui diz *como controlar*,
 * seguindo a hierarquia da NR-01.
 */

/** `kind` gravado em `ai_usage_events` para o rate limiting por organização. */
export const AI_CONTROL_MEASURE_KIND = "control_measure_suggestion";

/**
 * Teto de sugestões. Não é escolha estética: `uq_control_measures_org_risk_level` admite
 * **uma** medida por nível de controle por risco, e os níveis são quatro.
 */
export const MAX_MEASURE_SUGGESTIONS = 4;

/** `null`/`""`/espaços → `undefined`; senão string não-vazia. Robusto à saída do LLM. */
const optionalText = z.preprocess(
  (v) => (v == null || (typeof v === "string" && v.trim() === "") ? undefined : v),
  z.string().trim().min(1).optional(),
);

/**
 * Sinônimos do nível de controle. Mesma razão do `normalizeAgentType`: o prompt pede o
 * valor em inglês, a conversa é em português, e sem isto uma resposta correta virava lista
 * vazia — indistinguível, na tela, de "a IA não encontrou nada".
 */
const CONTROL_LEVEL_ALIASES: Record<string, ControlLevel> = {
  eliminacao: "elimination",
  eliminar: "elimination",
  substituicao: "elimination",
  "protecao coletiva": "collective_protection",
  coletiva: "collective_protection",
  epc: "collective_protection",
  engenharia: "collective_protection",
  "controle de engenharia": "collective_protection",
  administrativo: "administrative",
  administrativa: "administrative",
  "controle administrativo": "administrative",
  epi: "ppe",
  "protecao individual": "ppe",
  "equipamento de protecao individual": "ppe",
};

/** Prefixos de ruído do nível: "medida de eliminação", "nível administrativo". */
const CONTROL_LEVEL_NOISE = /^(medida|nivel|controle)s?\s+(de\s+)?/;

/** Nível de controle tolerante a pt-BR; irreconhecível segue para o enum reprovar. */
export const normalizeControlLevel = aliasPreprocessor(
  CONTROL_LEVEL_ALIASES,
  CONTROL_LEVEL_NOISE,
);

/** Uma medida sugerida pela IA — só os campos que o modelo produz. */
export const suggestedControlMeasureSchema = z.object({
  controlLevel: z.preprocess(normalizeControlLevel, controlLevelSchema),
  actionWhat: z.string().trim().min(1, "Ação (o quê) é obrigatória"),
  actionHow: z.string().trim().min(1, "Ação (como) é obrigatória"),
  monitoring: optionalText,
  justification: optionalText,
});

export type SuggestedControlMeasure = z.infer<typeof suggestedControlMeasureSchema>;

/** Entrada da ação de aceite: as medidas selecionadas/revisadas pelo usuário. */
export const acceptSuggestedMeasuresInputSchema = z.object({
  suggestions: z.array(suggestedControlMeasureSchema).min(1).max(MAX_MEASURE_SUGGESTIONS),
});

export type AcceptSuggestedMeasuresInput = z.input<
  typeof acceptSuggestedMeasuresInputSchema
>;

/**
 * Contexto **não-PII** do risco enviado ao LLM: o risco, o ambiente do GES e a
 * classificação vigente. Nunca inclui `employees` — só **títulos** de função.
 */
export type RiskControlContext = {
  agentType: string;
  hazard: string | null;
  description: string;
  sources: string | null;
  possibleInjuries: string | null;
  gesName: string | null;
  processDescription: string | null;
  environment: string | null;
  roleTitles: string[];
  classification: RiskClassification | null;
  riskLevel: number | null;
  /** Níveis que já têm medida cadastrada — a UNIQUE impede propor de novo. */
  existingLevels: ControlLevel[];
};

/**
 * Valida a saída crua do modelo **item a item**: descarta os inválidos (Zod rejeita o
 * item, não o lote) e remove nível repetido. Lista vazia é resultado válido. Aceita
 * `unknown[]` ou `{ measures: [...] }`. O descarte dos níveis já cadastrados é do core
 * (`dropExistingLevels`) — depende do banco, não da resposta do modelo.
 */
export function parseModelMeasures(raw: unknown): SuggestedControlMeasure[] {
  const arr = Array.isArray(raw)
    ? raw
    : raw &&
        typeof raw === "object" &&
        Array.isArray((raw as { measures?: unknown }).measures)
      ? (raw as { measures: unknown[] }).measures
      : null;
  if (!arr) return [];

  const taken = new Set<string>();
  const out: SuggestedControlMeasure[] = [];
  for (const item of arr) {
    const parsed = suggestedControlMeasureSchema.safeParse(item);
    if (!parsed.success || taken.has(parsed.data.controlLevel)) continue;
    taken.add(parsed.data.controlLevel);
    out.push(parsed.data);
    if (out.length >= MAX_MEASURE_SUGGESTIONS) break;
  }
  return ordenarPelaHierarquia(out);
}

/** Ordem da NR-01: eliminar > coletiva > administrativa > EPI. */
const HIERARCHY: ControlLevel[] = [
  "elimination",
  "collective_protection",
  "administrative",
  "ppe",
];

function ordenarPelaHierarquia(
  measures: SuggestedControlMeasure[],
): SuggestedControlMeasure[] {
  return [...measures].sort(
    (a, b) => HIERARCHY.indexOf(a.controlLevel) - HIERARCHY.indexOf(b.controlLevel),
  );
}

/**
 * Mapeia uma medida aceita para `ControlMeasureValues`. Toda medida sugerida entra como
 * **aplicável** (a IA só propõe o que cabe) e `status` fica indefinido: quem decide é a
 * regra do servidor, pela classificação vigente do risco (`applyMeasureStatusRule`).
 * Responsável e prazo ficam em branco de propósito — são compromisso de pessoa, não
 * palpite de modelo.
 */
export function toControlMeasureValuesFromSuggestion(
  s: SuggestedControlMeasure,
): ControlMeasureValues {
  return {
    controlLevel: s.controlLevel,
    applicable: true,
    status: undefined,
    justification: s.justification,
    monitoring: s.monitoring,
    actionWhat: s.actionWhat,
    actionHow: s.actionHow,
    actionTracking: undefined,
    actionMeasurement: undefined,
    actionResponsible: undefined,
    actionDeadline: undefined,
  };
}

/** Rótulos pt-BR usados na montagem do prompt (reexport para o agente, que é puro). */
export { controlLevelLabel, riskClassificationLabel };

/**
 * Remove as medidas cujo nível o risco já tem. A UNIQUE `(org, risk, level)` recusaria no
 * insert, e é melhor não oferecer do que quebrar no aceite depois que o usuário escolheu.
 */
export function dropExistingLevels(
  measures: readonly SuggestedControlMeasure[],
  existingLevels: readonly ControlLevel[],
): SuggestedControlMeasure[] {
  const taken = new Set<string>(existingLevels);
  return measures.filter((m) => !taken.has(m.controlLevel));
}
