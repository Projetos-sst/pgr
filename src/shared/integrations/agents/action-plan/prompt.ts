import type { SuggestionInput } from "@/shared/domains/safety/action-plan-suggestion";

import { readToolCallArguments, type ToolCall, type ToolDefinition } from "../tool-call";

/**
 * Construção do prompt e leitura da resposta da sugestão 5W2H — **puro** (sem `server-only`,
 * sem cliente HTTP). O input já vem sanitizado (allowlist não-PII); aqui ele vira mensagens e a
 * saída do tool call vira o objeto 5W2H cru (validado por Zod no core). Testável isoladamente:
 * garante que só campos da allowlist entram no prompt.
 */

export const ACTION_PLAN_TOOL_NAME = "record_action_plan";

/** Definição da ferramenta (structured output via tool call) enviada ao modelo. */
export function buildActionPlanTool(): ToolDefinition {
  return {
    type: "function",
    function: {
      name: ACTION_PLAN_TOOL_NAME,
      description:
        "Registra um plano de ação 5W2H sugerido para tratar a origem informada (NR-01/GRO).",
      parameters: {
        type: "object",
        properties: {
          what: { type: "string", description: "O que será feito (ação corretiva)." },
          why: { type: "string", description: "Por que a ação é necessária." },
          who: {
            type: "string",
            description: "Área/função responsável (sem nome de pessoa).",
          },
          where: { type: "string", description: "Onde a ação será executada." },
          when: {
            type: "string",
            description: "Prazo sugerido no formato AAAA-MM-DD (opcional).",
          },
          how: { type: "string", description: "Como a ação será executada." },
          howMuch: { type: "number", description: "Custo estimado em R$ (opcional)." },
          priority: {
            type: "integer",
            description: "Prioridade 1 (baixa) a 3 (alta).",
            minimum: 1,
            maximum: 3,
          },
        },
        required: ["what", "why", "who", "where", "how"],
      },
    },
  };
}

function line(label: string, value: string | undefined | null): string | null {
  return value && value.trim() !== "" ? `- ${label}: ${value.trim()}` : null;
}

/**
 * Monta as mensagens a partir **exclusivamente** do input sanitizado. Para incidente, usa
 * apenas a versão anônima (tipo/categoria/severidade/circunstâncias técnicas) — nunca PII.
 */
export function buildActionPlanPrompt(input: SuggestionInput): {
  system: string;
  user: string;
} {
  const system = [
    "Você é um especialista em Segurança e Saúde do Trabalho (SST) no Brasil, com domínio da NR-01/GRO.",
    "Sua tarefa é sugerir UM plano de ação 5W2H para tratar a origem (risco ou incidente) descrita pelo usuário.",
    "Baseie-se APENAS no contexto técnico fornecido. Não invente dados que não estão no contexto.",
    "NUNCA cite nomes de pessoas, CPF, dados médicos ou identificadores internos. Em 'Quem', use área/função responsável.",
    "Retorne o plano exclusivamente pela ferramenta record_action_plan.",
  ].join("\n");

  const lines: (string | null)[] =
    input.kind === "risk"
      ? [
          "Sugira um plano de ação 5W2H para tratar o risco ocupacional abaixo.",
          "",
          line("Grupo do agente", input.agentType),
          line("Descrição do risco", input.description),
          line("Perigo", input.hazard),
          line("Fontes geradoras", input.sources),
          line("Possíveis lesões (genérico)", input.possibleInjuries),
          line("GES", input.gesName),
          line("Descrição do processo", input.processDescription),
          line("Ambiente", input.environment),
          input.roleTitles && input.roleTitles.length > 0
            ? `- Funções expostas: ${input.roleTitles.join("; ")}`
            : null,
        ]
      : [
          "Sugira um plano de ação 5W2H para tratar o incidente/acidente (versão anônima) abaixo.",
          "",
          line("Tipo", input.type),
          line("Categoria", input.category),
          line("Severidade", input.severity),
          line("Local (genérico)", input.location),
          line("Circunstâncias", input.description),
          line("Causas técnicas", input.causes),
          line("Atividade/procedimento", input.activityProcedure),
          line("Área responsável", input.responsibleArea),
          line("Impacto ambiental", input.environmentalImpact),
          line("Perdas materiais", input.materialLoss),
        ];

  const user = lines.filter((l): l is string => l !== null).join("\n");
  return { system, user };
}

/**
 * Extrai o objeto 5W2H cru do tool call e **normaliza** a chave de custo: alguns modelos
 * emitem `how_much` (snake_case) apesar do tool schema camelCase — mapeamos para `howMuch` para o
 * validador (que é `.strict()`). Sem tool call válido → `null`.
 */
export function extractActionPlan(calls: ToolCall[]): unknown {
  const args = readToolCallArguments(calls, ACTION_PLAN_TOOL_NAME);
  if (!args || typeof args !== "object" || Array.isArray(args)) return args ?? null;

  const obj = args as Record<string, unknown>;
  if ("how_much" in obj && !("howMuch" in obj)) {
    const { how_much, ...rest } = obj;
    return { ...rest, howMuch: how_much };
  }
  return obj;
}
