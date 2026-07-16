import { z } from "zod";

const uuid = z.string().uuid({ message: "Identificador inválido" });

// Resposta a uma pergunta: valueInt (Likert/escolha) OU valueText (livre).
export const answerInputSchema = z.object({
  questionId: uuid,
  valueInt: z.coerce.number().int().min(0).max(10).nullable().optional(),
  valueText: z
    .string()
    .trim()
    .max(2000, "Resposta muito longa (máx. 2000 caracteres).")
    .nullable()
    .optional(),
});

export const submitResponseSchema = z.object({
  answers: z.array(answerInputSchema).default([]),
});
export type SubmitResponseInput = z.input<typeof submitResponseSchema>;
export type SubmitResponseValues = z.output<typeof submitResponseSchema>;
