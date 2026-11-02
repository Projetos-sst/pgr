import { z } from "zod";

/**
 * Vínculo profissional ↔ conta de acesso (NOB-149). A conta precisa ser membro do escritório;
 * o profissional precisa estar ativo. Motivo obrigatório para vincular e para revogar.
 */
const reason = z
  .string()
  .trim()
  .min(10, "Descreva o motivo (mínimo de 10 caracteres).")
  .max(1000, "Máximo de 1000 caracteres.");

export const professionalLinkSchema = z
  .object({
    userId: z.string().trim().min(1, "Selecione a conta.").max(200, "Conta inválida."),
    reason,
  })
  .strict();
export type ProfessionalLinkValues = z.infer<typeof professionalLinkSchema>;

export const professionalRevokeSchema = z.object({ reason }).strict();
export type ProfessionalRevokeValues = z.infer<typeof professionalRevokeSchema>;
