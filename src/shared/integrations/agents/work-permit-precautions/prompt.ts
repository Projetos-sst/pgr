import { z } from "zod";

import {
  MAX_PRECAUTION_LENGTH,
  MAX_PRECAUTIONS,
  type WorkPermitPrecautionsContext,
} from "@/shared/domains/work-permits/ai-precautions-fill";

import { flexibleText } from "../core/flexible-text";
import { line } from "../core/prompt-line";

export const workPermitPrecautionsOutputSchema = z.object({
  precautions: z
    .array(
      z.object({
        description: flexibleText(
          `Uma precaução ou medida de controle, com no máximo ${MAX_PRECAUTION_LENGTH} caracteres.`,
        ),
      }),
    )
    .describe(
      `Precauções da permissão de trabalho, no máximo ${MAX_PRECAUTIONS}, da mais crítica para a menos. Lista vazia é resposta válida quando o contexto não sustenta nenhuma precaução.`,
    ),
});

export type WorkPermitPrecautionsOutput = z.infer<
  typeof workPermitPrecautionsOutputSchema
>;

export const WORK_PERMIT_PRECAUTIONS_INSTRUCTIONS = [
  "Você é um especialista em Segurança e Saúde do Trabalho (SST) no Brasil, com domínio das NRs que tratam de trabalhos de alto risco: NR-10 (eletricidade), NR-18 (construção e escavação), NR-20, NR-33 (espaço confinado), NR-34 (trabalho a quente) e NR-35 (trabalho em altura).",
  "Sua tarefa é preencher as precauções e medidas de controle de UMA Permissão de Trabalho (PT), a partir do tipo de trabalho, da área e da descrição da atividade.",
  "",
  "Regras:",
  "1. Cada item é uma precaução verificável antes ou durante o trabalho: o que fazer e com o quê. 'Tenha cuidado' não é precaução.",
  "2. Uma exigência por item. Não junte duas medidas na mesma frase.",
  "3. Cubra, nesta ordem: liberação e isolamento da área, bloqueio de energias, medições obrigatórias antes do início (sem informar valores), equipamentos de proteção coletiva, EPIs, vigia ou supervisão, condições que obrigam a interromper o trabalho e o plano de emergência.",
  "4. Cite a NR aplicável quando a exigência vier dela. Não invente número de item de norma.",
  "5. Nunca invente valor medido, limite de tolerância, CA de EPI nem nome de equipamento que não seja genérico.",
  `6. No máximo ${MAX_PRECAUTIONS} itens e no máximo ${MAX_PRECAUTION_LENGTH} caracteres cada.`,
  "7. Não repita precaução que já conste na PT.",
  "8. NUNCA cite nome de pessoa, CPF, matrícula ou dado médico.",
  "9. Escreva em português do Brasil, em linguagem técnica de SST, objetiva.",
].join("\n");

export function buildWorkPermitPrecautionsPrompt(
  ctx: WorkPermitPrecautionsContext,
): string {
  const existing = ctx.existingPrecautions.map((item) => `  - ${item}`);
  return [
    "Preencha as precauções da Permissão de Trabalho abaixo.",
    "",
    line("Tipo de trabalho", ctx.typeLabel),
    line("Área / local", ctx.area),
    line("Descrição do trabalho", ctx.description),
    existing.length > 0 ? "\nPrecauções que a PT já contém (não repita):" : null,
    existing.length > 0 ? existing.join("\n") : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}
