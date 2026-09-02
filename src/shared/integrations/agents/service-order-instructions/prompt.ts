import { z } from "zod";

import {
  MAX_INSTRUCTION_SUGGESTIONS,
  type ServiceOrderInstructionContext,
} from "@/shared/domains/safety/ai-service-order-instructions";
import { MAX_ITEM_DESCRIPTION } from "@/shared/domains/safety/service-order";

import { flexibleText } from "../core/flexible-text";

/**
 * Instruções, schema de saída e montagem da mensagem do agente de **instruções de segurança
 * da OS** — **puro** (sem `server-only`, sem rede). Os testes unitários exercitam aqui a
 * garantia de que nenhum dado pessoal do trabalhador designado entra no prompt.
 */

export const serviceOrderInstructionOutputSchema = z.object({
  instructions: z
    .array(
      z.object({
        description: flexibleText(
          `Uma instrução de segurança, na voz imperativa, com no máximo ${MAX_ITEM_DESCRIPTION} caracteres.`,
        ),
      }),
    )
    .describe(
      `Instruções de segurança da OS, no máximo ${MAX_INSTRUCTION_SUGGESTIONS}, da mais crítica para a menos. Lista vazia é resposta válida quando o contexto não sustenta nenhuma instrução.`,
    ),
});

export type ServiceOrderInstructionOutput = z.infer<
  typeof serviceOrderInstructionOutputSchema
>;

export const SERVICE_ORDER_INSTRUCTIONS = [
  "Você é um especialista em Segurança e Saúde do Trabalho (SST) no Brasil, com domínio da NR-01, em especial do item 1.4.1 — a Ordem de Serviço deve informar ao trabalhador os riscos da sua função e as medidas de prevenção que ele deve cumprir.",
  "Sua tarefa é redigir as instruções de segurança de UMA Ordem de Serviço, a partir da função, dos riscos e dos EPIs da atividade.",
  "",
  "Regras:",
  "1. Escreva cada instrução na voz imperativa, dirigida ao trabalhador: 'Utilize...', 'Inspecione...', 'Interrompa...'. É ele quem vai ler e assinar.",
  "2. Uma obrigação por item. Não junte duas exigências na mesma frase.",
  "3. Cada instrução deve ser verificável: diga o que fazer, quando e com o quê. 'Trabalhe com atenção' não é instrução.",
  "4. Cubra, nesta ordem: os riscos listados, o uso correto dos EPIs informados, as condições que obrigam a interromper a atividade e o dever de comunicar condição insegura.",
  "5. Cite o EPI pelo nome que aparece no contexto. Não invente EPI, CA, equipamento ou norma que não esteja no texto.",
  `6. No máximo ${MAX_INSTRUCTION_SUGGESTIONS} instruções e no máximo ${MAX_ITEM_DESCRIPTION} caracteres cada.`,
  "7. Não repita instrução que já conste nos itens atuais da OS.",
  "8. NUNCA cite nome de pessoa, CPF, matrícula ou dado médico. Refira-se ao trabalhador de forma impessoal.",
  "9. Escreva em português do Brasil, em linguagem direta e simples — quem lê é o trabalhador, não o técnico.",
].join("\n");

function line(label: string, value: string | null | undefined): string | null {
  return value && value.trim() !== "" ? `- ${label}: ${value.trim()}` : null;
}

/**
 * Monta a mensagem **exclusivamente** a partir do contexto não-PII: função, GES, unidade,
 * riscos e EPIs. O trabalhador designado entra só pelo **título da função** — a OS é
 * assinada por uma pessoa concreta, mas o prompt não precisa saber quem ela é.
 */
export function buildServiceOrderInstructionPrompt(
  ctx: ServiceOrderInstructionContext,
): string {
  const lista = (items: string[]) =>
    items.length > 0 ? items.map((i) => `  - ${i}`).join("\n") : "  - nenhum informado";

  return [
    "Redija as instruções de segurança da Ordem de Serviço abaixo.",
    "",
    line("Título da OS", ctx.title),
    line("Tipo", ctx.osType),
    line("Função do trabalhador", ctx.jobRoleTitle),
    line("GES", ctx.gesName),
    line("Unidade/obra", ctx.workUnitName),
    "",
    "Riscos da atividade:",
    lista(ctx.risks.map((r) => r.description)),
    "",
    "EPIs previstos:",
    lista(ctx.epis.map((e) => e.name)),
    ctx.existingItems.length > 0 ? "\nItens que a OS já contém (não repita):" : null,
    ctx.existingItems.length > 0 ? lista(ctx.existingItems) : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}
