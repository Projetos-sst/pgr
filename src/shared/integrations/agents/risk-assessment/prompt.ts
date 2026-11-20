import { z } from "zod";

import type { RiskAssessmentFillContext } from "@/shared/domains/pgr/ai-risk-assessment-fill";
import {
  PROBABILITY_LABELS,
  SEVERITY_LABELS,
} from "@/shared/domains/pgr/risk-assessment";

import { flexibleOptionalText, flexibleText } from "../core/flexible-text";

export const riskAssessmentOutputSchema = z.object({
  criterion: flexibleText(
    "Critério da avaliação: qualitative ou quantitative. Use quantitative só quando o risco já tem medição registrada.",
  ),
  probability: flexibleText("Probabilidade de 1 a 5, como número inteiro."),
  severity: flexibleText("Severidade de 1 a 5, como número inteiro."),
  evaluationMethod: flexibleOptionalText(
    "Método de avaliação quantitativa (ex.: NHO-01). Só no critério quantitativo.",
  ),
  justification: flexibleOptionalText(
    "Por que essa probabilidade e essa severidade, em uma ou duas frases.",
  ),
});

export type RiskAssessmentOutput = z.infer<typeof riskAssessmentOutputSchema>;

function scale(labels: Record<number, string>): string {
  return Object.entries(labels)
    .map(([value, label]) => `${value} = ${label}`)
    .join("; ");
}

export const RISK_ASSESSMENT_INSTRUCTIONS = [
  "Você é um especialista em Segurança e Saúde do Trabalho (SST) no Brasil, com domínio da NR-01 (GRO/PGR) e da NR-09.",
  "Sua tarefa é preencher a avaliação de UM risco ocupacional na matriz 5×5 de probabilidade × severidade.",
  "",
  "Regras:",
  "1. Em 'criterion', use qualitative. Use quantitative somente quando o contexto disser que há medição registrada para o risco.",
  `2. Em 'probability', um inteiro de 1 a 5: ${scale(PROBABILITY_LABELS)}.`,
  `3. Em 'severity', um inteiro de 1 a 5: ${scale(SEVERITY_LABELS)}.`,
  "4. Em 'evaluationMethod', só no critério quantitativo, o método normativo de avaliação (ex.: NHO-01 para ruído). No qualitativo, deixe vazio.",
  "5. Nunca invente valor medido, unidade de medida, limite de tolerância, grau de incerteza nem conclusão da NR-09: esses dados vêm da medição feita pelo profissional.",
  "6. Em 'justification', explique em uma ou duas frases a probabilidade e a severidade escolhidas.",
  "7. Baseie-se APENAS no contexto fornecido. Nunca cite nome de pessoa, CPF ou dado médico.",
  "8. Escreva em português do Brasil, em linguagem técnica de SST, objetiva.",
].join("\n");

function line(label: string, value: string | null): string | null {
  return value && value.trim() !== "" ? `- ${label}: ${value.trim()}` : null;
}

export function buildRiskAssessmentPrompt(ctx: RiskAssessmentFillContext): string {
  return [
    "Preencha a avaliação do risco ocupacional abaixo.",
    "",
    line("Grupo do agente", ctx.agentType),
    line("Descrição do risco", ctx.description),
    line("Perigo", ctx.hazard),
    line("Fontes geradoras", ctx.sources),
    line("Propagação", ctx.propagation),
    line("Tempo de exposição", ctx.exposureTime),
    line("Possíveis danos à saúde", ctx.possibleInjuries),
    `- Medição registrada para o risco: ${ctx.hasMeasuredValue ? "sim" : "não"}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}
