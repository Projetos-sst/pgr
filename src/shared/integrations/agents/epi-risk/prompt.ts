import { z } from "zod";

import {
  MAX_EPI_FILL_LINKS,
  type EpiRiskFillContext,
} from "@/shared/domains/pgr/ai-epi-risk-fill";
import { EPI_NEUTRALIZATION_ORDER } from "@/shared/domains/pgr/epi-risk";

import { flexibleOptionalText, flexibleText } from "../core/flexible-text";
import { line } from "../core/prompt-line";

export const epiRiskOutputSchema = z.object({
  links: z
    .array(
      z.object({
        catalogId: flexibleText("O id exato do EPI, copiado da lista do catálogo."),
        neutralization: flexibleText(
          `Se o EPI neutraliza o risco. Um de: ${EPI_NEUTRALIZATION_ORDER.join(", ")}.`,
        ),
        rationale: flexibleOptionalText("Por que este EPI se aplica a este risco."),
      }),
    )
    .describe(
      `EPIs do catálogo que se aplicam ao risco, no máximo ${MAX_EPI_FILL_LINKS}. Lista vazia é resposta válida quando nenhum EPI da lista serve.`,
    ),
});

export type EpiRiskOutput = z.infer<typeof epiRiskOutputSchema>;

export const EPI_RISK_INSTRUCTIONS = [
  "Você é um especialista em Segurança e Saúde do Trabalho (SST) no Brasil, com domínio da NR-06 (EPI) e da NR-09.",
  "Sua tarefa é indicar quais EPIs do catálogo da empresa se aplicam a UM risco ocupacional e se cada um neutraliza o risco.",
  "",
  "Regras:",
  "1. Escolha SOMENTE EPIs da lista do catálogo enviada. Nunca invente EPI, marca ou CA.",
  "2. Em 'catalogId', copie o id exato do EPI como aparece na lista.",
  `3. Em 'neutralization', use um de: ${EPI_NEUTRALIZATION_ORDER.join(", ")}. Use neutralizes só quando o EPI, usado corretamente, elimina ou reduz a exposição a nível aceitável; does_not_neutralize quando protege só em parte; not_applicable quando o EPI é exigido mas a neutralização não se aplica ao agente.`,
  `4. No máximo ${MAX_EPI_FILL_LINKS} EPIs, e só os que de fato protegem contra este risco.`,
  "5. Em 'rationale', diga em uma frase por que o EPI se aplica a este risco.",
  "6. Baseie-se APENAS no contexto fornecido. Sem EPI adequado na lista, devolva lista vazia.",
  "7. Nunca cite nome de pessoa, CPF ou dado médico.",
  "8. Escreva em português do Brasil, em linguagem técnica de SST, objetiva.",
].join("\n");

export function buildEpiRiskPrompt(ctx: EpiRiskFillContext): string {
  const catalog = ctx.catalog.map(
    (c) => `- id: ${c.catalogId} | ${c.name}${c.ca ? ` | CA ${c.ca}` : ""}`,
  );
  return [
    "Indique os EPIs do catálogo que se aplicam ao risco ocupacional abaixo.",
    "",
    line("Grupo do agente", ctx.agentType),
    line("Descrição do risco", ctx.description),
    line("Perigo", ctx.hazard),
    line("Fontes geradoras", ctx.sources),
    line("Propagação", ctx.propagation),
    line("Tempo de exposição", ctx.exposureTime),
    "",
    "EPIs do catálogo (escolha só destes, pelo id exato):",
    ...catalog,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}
