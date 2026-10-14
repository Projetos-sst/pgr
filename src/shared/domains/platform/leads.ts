import { z } from "zod";

/**
 * Regras do pré-cadastro de interessados (portal público).
 *
 * Campos mínimos de propósito: nome, empresa, e-mail, telefone, interesse e uma
 * mensagem opcional. **Nenhum dado sensível** — sem CPF, sem data de nascimento
 * e sem nada de saúde. É um contato comercial, não um cadastro de pessoa.
 */
export const LEAD_INTEREST_VALUES = ["safety", "health", "both"] as const;
export const LEAD_SOURCE_VALUES = ["quote", "landing"] as const;

export const LEAD_INTEREST_LABEL: Record<(typeof LEAD_INTEREST_VALUES)[number], string> =
  {
    safety: "Segurança do Trabalho",
    health: "Medicina do Trabalho",
    both: "As duas vertentes",
  };

/**
 * Telefone brasileiro em formato livre, mas com contagem de dígitos validada:
 * 10 (fixo com DDD) ou 11 (celular com DDD). Deixar a máscara livre evita
 * recusar um número correto por causa de parênteses ou hífen.
 */
const phoneSchema = z
  .string()
  .trim()
  .min(1, "Informe um telefone ou WhatsApp.")
  .refine(
    (value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 13;
    },
    { message: "Informe DDD e número (ex.: (11) 99999-9999)." },
  );

export const leadInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o seu nome.")
    .max(120, "Nome muito longo (máximo de 120 caracteres)."),
  company: z
    .string()
    .trim()
    .min(2, "Informe a empresa.")
    .max(160, "Nome da empresa muito longo (máximo de 160 caracteres)."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Informe um e-mail.")
    .max(180, "E-mail muito longo.")
    .pipe(z.string().email("E-mail inválido.")),
  phone: phoneSchema.max(40, "Telefone muito longo."),
  interest: z.enum(LEAD_INTEREST_VALUES, {
    message: "Escolha a área de interesse.",
  }),
  message: z
    .string()
    .trim()
    .max(1200, "Mensagem muito longa (máximo de 1200 caracteres).")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  source: z.enum(LEAD_SOURCE_VALUES).default("quote"),
});

export type LeadInput = z.input<typeof leadInputSchema>;
export type LeadValues = z.output<typeof leadInputSchema>;

/** Normaliza o `?interesse=` da URL para o valor do enum; `null` se não casar. */
export function parseInterestParam(raw: unknown): LeadValues["interest"] | null {
  if (typeof raw !== "string") return null;
  const map: Record<string, LeadValues["interest"]> = {
    seguranca: "safety",
    safety: "safety",
    medicina: "health",
    health: "health",
    ambos: "both",
    both: "both",
  };
  return map[raw.toLowerCase()] ?? null;
}
