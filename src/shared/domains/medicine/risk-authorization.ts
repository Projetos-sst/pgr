import { z } from "zod";
const text = (max: number) => z.string().trim().min(1).max(max);
export const professionalIdentitySchema = z
  .object({
    fullName: text(200),
    profession: text(200),
    registration: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("registered"),
          council: text(100),
          number: text(100),
          region: z.string().trim().max(100).optional(),
        })
        .strict(),
      z.object({ kind: z.literal("not_applicable"), reason: text(1000) }).strict(),
    ]),
  })
  .strict();
export type ProfessionalIdentity = z.infer<typeof professionalIdentitySchema>;
export const companyAuthorizerSchema = z
  .object({
    userId: text(200).nullable(),
    evidence: text(2000),
    reason: text(1000),
  })
  .strict();
export const professionalAuthorizationSchema = z.discriminatedUnion("active", [
  z
    .object({
      active: z.literal(true),
      userId: text(200),
      identity: professionalIdentitySchema,
      reason: text(1000),
    })
    .strict(),
  z.object({ active: z.literal(false), userId: text(200), reason: text(1000) }).strict(),
]);
export const medicalRiskDecisionSchema = z
  .object({
    status: z.enum(["validated", "rejected"]),
    reason: text(5000),
    expectedStatus: z.enum(["pending", "validated", "rejected"]),
    expectedReviewedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict();
export type CompanyAuthorizerInput = z.infer<typeof companyAuthorizerSchema>;
export type ProfessionalAuthorizationInput = z.infer<
  typeof professionalAuthorizationSchema
>;
export type MedicalRiskDecisionInput = z.infer<typeof medicalRiskDecisionSchema>;
