import {
  parseModelSuggestions,
  type GesRiskContext,
  type SuggestedRisk,
} from "@/shared/domains/pgr/ai-risk-suggestion";
import { riskAgentTypeLabel, type RiskAgentType } from "@/shared/domains/pgr/risks";

import { readToolCallArguments, type ToolCall, type ToolDefinition } from "../tool-call";

/**
 * Construção do prompt e leitura da resposta — **puro** (sem `server-only`, sem
 * cliente HTTP): o contexto do GES vira mensagens e a saída do tool call vira sugestões
 * validadas. Testável isoladamente (garante que só campos do GES entram no prompt
 * e que a extração descarta itens inválidos).
 */

export const SUGGESTION_TOOL_NAME = "record_suggested_risks";

const AGENT_TYPES: RiskAgentType[] = [
  "physical",
  "chemical",
  "biological",
  "ergonomic",
  "mechanical",
  "accident",
  "psychosocial",
];

/** Definição da ferramenta (structured output via tool call) enviada ao modelo. */
export function buildSuggestionTool(): ToolDefinition {
  return {
    type: "function" as const,
    function: {
      name: SUGGESTION_TOOL_NAME,
      description:
        "Registra a lista de riscos ocupacionais sugeridos para o GES analisado (NR-01).",
      parameters: {
        type: "object" as const,
        properties: {
          risks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                agentType: {
                  type: "string",
                  enum: AGENT_TYPES,
                  description: "Grupo do agente de risco (NR-01).",
                },
                hazard: { type: "string", description: "Perigo associado ao risco." },
                description: {
                  type: "string",
                  description: "Descrição objetiva do risco ocupacional.",
                },
                sources: {
                  type: "string",
                  description: "Fontes geradoras do agente de risco.",
                },
              },
              required: ["agentType", "description"],
            },
          },
        },
        required: ["risks"],
      },
    },
  };
}

function contextLine(label: string, value: string | null): string | null {
  return value && value.trim() !== "" ? `- ${label}: ${value.trim()}` : null;
}

/**
 * Monta as mensagens da sugestão a partir **exclusivamente** do contexto do GES
 * (processo, ambiente, títulos de função) — nunca dados de funcionários/PII.
 */
export function buildRiskSuggestionPrompt(ctx: GesRiskContext): {
  system: string;
  user: string;
} {
  const agents = AGENT_TYPES.map((a) => `${a} (${riskAgentTypeLabel(a)})`).join(", ");
  const system = [
    "Você é um especialista em Segurança e Saúde do Trabalho (SST) no Brasil, com domínio da NR-01/GRO.",
    "Sua tarefa é sugerir riscos ocupacionais para um GES (Grupo de Exposição Similar) a partir do contexto fornecido.",
    `Cada risco tem um grupo de agente entre: ${agents}.`,
    "Baseie-se APENAS no contexto do GES fornecido pelo usuário. Se o contexto for vago ou insuficiente, sugira poucos riscos ou nenhum — nunca invente informação que não está no contexto.",
    "Não solicite dados pessoais de trabalhadores. Retorne os riscos exclusivamente pela ferramenta record_suggested_risks.",
  ].join("\n");

  const roles =
    ctx.roles.length > 0
      ? ctx.roles.map((r) => `${r.title} (${r.workerCount} trabalhador(es))`).join("; ")
      : "não informadas";

  const user = [
    "Sugira os riscos ocupacionais deste GES. Para cada risco informe: grupo do agente, perigo, descrição e fontes geradoras.",
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

  return { system, user };
}

/**
 * Extrai as sugestões do tool call da resposta do modelo. Sem tool call válido
 * → lista vazia. Delega a validação item-a-item a `parseModelSuggestions`.
 */
export function extractSuggestions(calls: ToolCall[]): SuggestedRisk[] {
  return parseModelSuggestions(readToolCallArguments(calls, SUGGESTION_TOOL_NAME));
}
