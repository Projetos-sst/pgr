import { z } from "zod";
// Mensagens próprias em PT: sem elas, o texto padrão do Zod (em inglês) chegava à tela.
const text = (max: number, required: string) =>
  z
    .string({ error: required })
    .trim()
    .min(1, required)
    .max(max, `Máximo de ${max.toLocaleString("pt-BR")} caracteres.`);
const STALE = "Atualize a página e tente novamente.";
import { professionalIdentitySchema } from "@/shared/domains/professional-identity";
export {
  professionalIdentitySchema,
  type ProfessionalIdentity,
} from "@/shared/domains/professional-identity";
export const companyAuthorizerSchema = z
  .object({
    userId: text(200, "Selecione o autorizador indicado.").nullable(),
    evidence: text(2000, "Informe a evidência da indicação da empresa."),
    reason: text(1000, "Informe o motivo do registro ou da substituição."),
  })
  .strict();
const professionalUserId = text(200, "Selecione a conta do profissional.");
const professionalReason = text(1000, "Informe o motivo da autorização ou da revogação.");
export const professionalAuthorizationSchema = z.discriminatedUnion(
  "active",
  [
    z
      .object({
        active: z.literal(true),
        userId: professionalUserId,
        identity: professionalIdentitySchema,
        reason: professionalReason,
      })
      .strict(),
    z
      .object({
        active: z.literal(false),
        userId: professionalUserId,
        reason: professionalReason,
      })
      .strict(),
  ],
  { error: "Selecione a operação de autorização ou revogação." },
);
export const medicalRiskDecisionSchema = z
  .object({
    status: z.enum(["validated", "rejected"], { error: "Selecione a decisão técnica." }),
    reason: text(5000, "Registre o parecer e o motivo da decisão."),
    expectedStatus: z.enum(["pending", "validated", "rejected"], { error: STALE }),
    expectedReviewedAt: z.iso.datetime({ offset: true, error: STALE }).nullable(),
  })
  .strict();
export type AppointmentOrigin = "office_owner" | "company_representative";
const APPOINTMENT_ORIGIN_LABELS: Record<AppointmentOrigin, string> = {
  office_owner: "Registro feito pelo escritório",
  company_representative: "Indicação feita pelo representante da empresa",
};
export function appointmentOriginLabel(origin: unknown): string | null {
  if (origin === "office_owner" || origin === "company_representative")
    return APPOINTMENT_ORIGIN_LABELS[origin];
  return null;
}
export type CompanyAuthorizerInput = z.infer<typeof companyAuthorizerSchema>;
export type ProfessionalAuthorizationInput = z.infer<
  typeof professionalAuthorizationSchema
>;
export type MedicalRiskDecisionInput = z.infer<typeof medicalRiskDecisionSchema>;
