import { z } from "zod";

import { requiredUuid } from "@/shared/domains/pgr/form-fields";

export const INTEREST_MESSAGE_MAX_LENGTH = 500;

export const interestServiceSchema = z.enum(["pgr", "medicine", "pro", "one_off"]);
export type InterestService = z.infer<typeof interestServiceSchema>;

export const interestStatusSchema = z.enum(["open", "seen"]);
export type InterestStatus = z.infer<typeof interestStatusSchema>;

const messageSchema = z
  .string()
  .trim()
  .max(
    INTEREST_MESSAGE_MAX_LENGTH,
    `A mensagem aceita até ${INTEREST_MESSAGE_MAX_LENGTH} caracteres.`,
  )
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const interestInputSchema = z
  .object({
    companyId: requiredUuid("Empresa inválida."),
    service: interestServiceSchema,
    message: messageSchema,
  })
  .strict();
export type InterestInput = z.infer<typeof interestInputSchema>;

const pageNumber = z.number().int().positive().optional();

export const interestFiltersSchema = z.object({
  page: pageNumber,
  pageSize: pageNumber,
  companyId: requiredUuid("Empresa inválida.").optional(),
  status: interestStatusSchema.optional(),
});
export type InterestFilters = z.infer<typeof interestFiltersSchema>;

export const interestIdSchema = requiredUuid("Interesse inválido.");

export function isInterestOpen(interest: { seenAt: Date | null }): boolean {
  return interest.seenAt === null;
}
