import { z } from "zod";

import type { SuggestionInput } from "@/shared/domains/safety/action-plan-suggestion";

/**
 * Instruções, schema de saída e montagem da mensagem do agente 5W2H — **puro** (sem
 * `server-only`, sem rede). O input já vem sanitizado (allowlist não-PII); aqui ele vira a
 * mensagem enviada ao modelo. Testável isoladamente: garante que só campos da allowlist
 * entram no prompt.
 */

/**
 * Schema **tolerante** de propósito: aceita o que o modelo costuma emitir (número como
 * texto, prazo ausente) e deixa a validação estrita para `actionPlanSuggestionSchema` no
 * core. `.describe()` importa: com `jsonPromptInjection` o schema vira parte do prompt.
 */
export const actionPlanOutputSchema = z.object({
  what: z.string().describe("O que será feito — a ação corretiva, no infinitivo."),
  why: z.string().describe("Por que a ação é necessária, ligando ao risco/incidente."),
  who: z
    .string()
    .describe(
      "Área ou função responsável. NUNCA nome de pessoa (ex.: 'SESMT', 'Manutenção').",
    ),
  where: z.string().describe("Onde a ação será executada."),
  how: z.string().describe("Como executar — passos concretos, na ordem."),
  when: z
    .string()
    .nullish()
    .describe(
      "Prazo sugerido no formato AAAA-MM-DD. Omita se não houver base para estimar.",
    ),
  howMuch: z
    .union([z.number(), z.string()])
    .nullish()
    .describe(
      "Custo estimado em reais, apenas o número. Omita se não houver base para estimar.",
    ),
  priority: z
    .union([z.number(), z.string()])
    .nullish()
    .describe("Prioridade: 1 baixa, 2 média, 3 alta."),
});

export type ActionPlanOutput = z.infer<typeof actionPlanOutputSchema>;

/**
 * Papel e regras do agente. As regras estão numeradas porque modelos pequenos (os
 * gratuitos que usamos) seguem instrução enumerada melhor do que parágrafo corrido.
 */
export const ACTION_PLAN_INSTRUCTIONS = [
  "Você é um especialista em Segurança e Saúde do Trabalho (SST) no Brasil, com domínio da NR-01 e do Gerenciamento de Riscos Ocupacionais (GRO).",
  "Sua tarefa é propor UM plano de ação 5W2H para tratar a origem (risco ou incidente) que o usuário descreve.",
  "",
  "Regras:",
  "1. Baseie-se APENAS no contexto técnico fornecido. Não invente equipamento, norma, valor ou circunstância que não esteja no texto.",
  "2. Priorize a hierarquia de controle da NR-01: eliminar > substituir > controle de engenharia > controle administrativo > EPI. Só recorra a EPI quando as anteriores não couberem.",
  "3. Em 'Quem', informe a área ou função responsável. NUNCA cite nome de pessoa.",
  "4. NUNCA cite CPF, dados médicos, nome de hospital, testemunhas ou identificadores internos.",
  "5. 'Como' deve ser acionável: passos concretos e verificáveis, não intenção genérica.",
  "6. Só estime prazo e custo quando o contexto der base para isso; caso contrário, omita o campo.",
  "7. Escreva em português do Brasil, em linguagem técnica de SST, objetiva e sem rodeios.",
].join("\n");

function line(label: string, value: string | undefined | null): string | null {
  return value && value.trim() !== "" ? `- ${label}: ${value.trim()}` : null;
}

/**
 * Monta a mensagem a partir **exclusivamente** do input sanitizado. Para incidente, usa
 * apenas a versão anônima (tipo/categoria/severidade/circunstâncias técnicas) — nunca PII.
 */
export function buildActionPlanPrompt(input: SuggestionInput): string {
  const lines: (string | null)[] =
    input.kind === "risk"
      ? [
          "Proponha um plano de ação 5W2H para tratar o risco ocupacional abaixo.",
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
          "Proponha um plano de ação 5W2H para tratar o incidente/acidente (versão anônima) abaixo.",
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

  return lines.filter((l): l is string => l !== null).join("\n");
}

/**
 * Normaliza a saída do modelo para o schema estrito do domínio. Três desvios observados em
 * respostas reais:
 *
 * 1. `how_much` em snake_case, apesar do schema pedir camelCase;
 * 2. "sem valor" expresso como `undefined`, `null` **ou string vazia**, conforme o modelo;
 * 3. números como texto (`"1500"`), resolvidos pela coerção do schema do domínio.
 *
 * Os dois primeiros precisam virar **chave ausente**: `when: ""` reprova em `z.iso.date()`
 * e derrubava o plano inteiro, e `howMuch: ""` é pior — a coerção numérica o transformaria
 * num custo de R$ 0 silenciosamente errado. Um campo opcional mal preenchido não pode
 * custar uma sugestão boa.
 */
export function normalizeActionPlanOutput(raw: ActionPlanOutput): unknown {
  const obj: Record<string, unknown> = { ...raw };

  if ("how_much" in obj && obj.howMuch == null) {
    obj.howMuch = obj.how_much;
    delete obj.how_much;
  }
  for (const [key, value] of Object.entries(obj)) {
    const vazio = value == null || (typeof value === "string" && value.trim() === "");
    if (vazio) delete obj[key];
  }
  return obj;
}
