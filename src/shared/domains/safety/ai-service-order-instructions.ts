import { z } from "zod";

import { MAX_ITEM_DESCRIPTION } from "./service-order";

/**
 * Domínio puro da **sugestão de instruções de segurança para a Ordem de Serviço**
 * (NR-01 1.4.1: a OS deve informar ao trabalhador os riscos e as medidas de prevenção da
 * sua função). Sem acesso a banco nem ao provedor — só a allowlist não-PII de entrada e a
 * validação da saída.
 *
 * Complementa `buildSuggestedItems`, que deriva itens de risco/EPI mecanicamente: aqui a
 * IA escreve a **instrução acionável** ("o que fazer"), que é o texto que ninguém gosta de
 * redigir e que a norma exige que exista.
 */

/** `kind` gravado em `ai_usage_events` para o rate limiting por organização. */
export const AI_SERVICE_ORDER_KIND = "service_order_instructions";

/** Teto por rodada — uma OS legível não comporta mais que isso. */
export const MAX_INSTRUCTION_SUGGESTIONS = 12;

/**
 * Uma instrução sugerida. O limite de tamanho é o mesmo da coluna
 * (`serviceOrderItemInputSchema`): instrução truncada no insert seria pior que descartada.
 */
export const suggestedInstructionSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Instrução é obrigatória")
    .max(
      MAX_ITEM_DESCRIPTION,
      `Instrução deve ter no máximo ${MAX_ITEM_DESCRIPTION} caracteres`,
    ),
});

export type SuggestedInstruction = z.infer<typeof suggestedInstructionSchema>;

/** Entrada da ação de aceite: as instruções selecionadas/revisadas pelo usuário. */
export const acceptSuggestedInstructionsInputSchema = z.object({
  suggestions: z
    .array(suggestedInstructionSchema)
    .min(1)
    .max(MAX_INSTRUCTION_SUGGESTIONS),
});

export type AcceptSuggestedInstructionsInput = z.input<
  typeof acceptSuggestedInstructionsInputSchema
>;

/**
 * Contexto **não-PII** da OS enviado ao LLM. O trabalhador designado entra apenas pelo
 * **título da função** — nunca nome, CPF, matrícula ou qualquer identificador: a OS é
 * assinada por uma pessoa concreta, e o prompt não precisa saber quem ela é.
 */
export type ServiceOrderInstructionContext = {
  title: string;
  osType: string | null;
  workUnitName: string | null;
  jobRoleTitle: string | null;
  gesName: string | null;
  risks: { description: string }[];
  epis: { name: string }[];
  /** Itens que a OS já tem — não faz sentido propor de novo o que está escrito. */
  existingItems: string[];
};

/** Chave de comparação para não repetir item já presente na OS. */
function instructionKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Valida a saída crua **item a item** (descarta o inválido sem derrubar o lote), remove
 * repetição interna e o que a OS já contém, e aplica o teto. Lista vazia é resultado
 * válido. Aceita `unknown[]` ou `{ instructions: [...] }`.
 */
export function parseModelInstructions(
  raw: unknown,
  existingItems: readonly string[] = [],
): SuggestedInstruction[] {
  const arr = Array.isArray(raw)
    ? raw
    : raw &&
        typeof raw === "object" &&
        Array.isArray((raw as { instructions?: unknown }).instructions)
      ? (raw as { instructions: unknown[] }).instructions
      : null;
  if (!arr) return [];

  const seen = new Set(existingItems.map(instructionKey));
  const out: SuggestedInstruction[] = [];
  for (const item of arr) {
    // O modelo alterna entre `"texto"` e `{ description: "texto" }`; ambos servem.
    const candidate = typeof item === "string" ? { description: item } : item;
    const parsed = suggestedInstructionSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const key = instructionKey(parsed.data.description);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed.data);
    if (out.length >= MAX_INSTRUCTION_SUGGESTIONS) break;
  }
  return out;
}
