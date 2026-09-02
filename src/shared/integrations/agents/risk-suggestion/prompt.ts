import { z } from "zod";

import type { GesRiskContext } from "@/shared/domains/pgr/ai-risk-suggestion";
import { MAX_SUGGESTIONS } from "@/shared/domains/pgr/ai-risk-suggestion";
import { riskAgentTypeLabel, type RiskAgentType } from "@/shared/domains/pgr/risks";

/**
 * Instruções, schema de saída e montagem da mensagem do agente de riscos — **puro**
 * (sem `server-only`, sem rede). É o que os testes unitários exercitam para garantir que
 * só o contexto permitido entra no prompt.
 */

const AGENT_TYPES: RiskAgentType[] = [
  "physical",
  "chemical",
  "biological",
  "ergonomic",
  "mechanical",
  "accident",
  "psychosocial",
];

/**
 * Schema **tolerante** de propósito: valida a forma do envelope, não o conteúdo de cada
 * item. A validação de verdade (enum do agente, campos obrigatórios) é do domínio, que
 * descarta item a item — um risco malformado no meio da lista não pode derrubar os outros
 * onze. `.describe()` importa: com `jsonPromptInjection` o schema vira parte do prompt.
 */
export const riskSuggestionOutputSchema = z.object({
  risks: z
    .array(
      z.object({
        agentType: z
          .string()
          .describe(
            `Grupo do agente de risco (NR-01). Um de: ${AGENT_TYPES.join(", ")}.`,
          ),
        hazard: z.string().optional().describe("Perigo associado ao risco."),
        description: z.string().describe("Descrição objetiva do risco ocupacional."),
        sources: z.string().optional().describe("Fontes geradoras do agente de risco."),
      }),
    )
    .describe(
      `Riscos ocupacionais do GES, no máximo ${MAX_SUGGESTIONS}. Lista vazia é resposta válida quando o contexto não sustenta nenhum risco.`,
    ),
});

export type RiskSuggestionOutput = z.infer<typeof riskSuggestionOutputSchema>;

/**
 * Papel e regras do agente. Fixo — o que muda por caso vai na mensagem. As regras estão
 * numeradas porque modelos pequenos (os gratuitos que usamos) seguem instrução enumerada
 * melhor do que um parágrafo corrido.
 */
export const RISK_SUGGESTION_INSTRUCTIONS = [
  "Você é um especialista em Segurança e Saúde do Trabalho (SST) no Brasil, com domínio da NR-01 e do Gerenciamento de Riscos Ocupacionais (GRO).",
  "Sua tarefa é identificar riscos ocupacionais de um GES (Grupo de Exposição Similar) a partir do contexto que o usuário fornece.",
  "",
  "Regras:",
  `1. Classifique cada risco em exatamente um grupo de agente: ${AGENT_TYPES.map((a) => `${a} (${riskAgentTypeLabel(a)})`).join(", ")}.`,
  "2. Baseie-se APENAS no contexto fornecido. Não presuma máquinas, produtos ou atividades que não foram descritos.",
  "3. Contexto vago ou insuficiente → devolva poucos riscos ou nenhum. Lista vazia é uma resposta correta; inventar risco não é.",
  `4. No máximo ${MAX_SUGGESTIONS} riscos, do mais relevante para o menos relevante.`,
  "5. Um risco por item: não agrupe dois agentes diferentes na mesma descrição.",
  "6. Em 'fontes geradoras', cite o que no contexto gera o agente — equipamento, processo ou condição do ambiente.",
  "7. Nunca peça nem cite dados pessoais de trabalhadores (nome, CPF, dados médicos).",
  "8. Escreva em português do Brasil, em linguagem técnica de SST, objetiva e sem rodeios.",
].join("\n");

function contextLine(label: string, value: string | null): string | null {
  return value && value.trim() !== "" ? `- ${label}: ${value.trim()}` : null;
}

/**
 * Monta a mensagem a partir **exclusivamente** do contexto do GES (processo, ambiente,
 * títulos de função) — nunca dados de funcionários/PII.
 */
export function buildRiskSuggestionPrompt(ctx: GesRiskContext): string {
  const roles =
    ctx.roles.length > 0
      ? ctx.roles.map((r) => `${r.title} (${r.workerCount} trabalhador(es))`).join("; ")
      : "não informadas";

  return [
    "Identifique os riscos ocupacionais do GES abaixo.",
    "",
    `GES: ${ctx.name}`,
    contextLine("Descrição do processo", ctx.processDescription),
    contextLine("Tipo de construção", ctx.constructionType),
    contextLine("Pé-direito (m)", ctx.ceilingHeight),
    contextLine("Piso", ctx.floor),
    contextLine("Cobertura", ctx.roof),
    contextLine("Iluminação", ctx.lighting),
    contextLine("Ventilação", ctx.ventilation),
    contextLine("Outras características", ctx.otherCharacteristics),
    `- Funções expostas: ${roles}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}
