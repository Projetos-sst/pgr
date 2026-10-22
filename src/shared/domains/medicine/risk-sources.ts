import { z } from "zod";
import { riskAgentTypeSchema } from "@/shared/domains/pgr/risks";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";

export const MEDICAL_RISK_STATUS_LABELS = {
  pending: "Pendente de revisão",
  validated: "Validado",
  rejected: "Rejeitado",
} as const;
export type MedicalRiskStatus = keyof typeof MEDICAL_RISK_STATUS_LABELS;

export const medicalRiskContentSchema = z
  .object({
    agentType: riskAgentTypeSchema,
    description: z.string().trim().min(1).max(5000),
    exposureGroup: z.string().trim().min(1).max(500),
    jobRole: z.string().trim().max(500).optional(),
    possibleInjuries: z.string().trim().max(5000).optional(),
    exposureDescription: z.string().trim().max(5000).optional(),
  })
  .strict();
export type MedicalRiskContent = z.infer<typeof medicalRiskContentSchema>;
export const medicalRiskListSchema = z.array(medicalRiskContentSchema).max(500);
export type MedicalRiskSnapshot = MedicalRiskContent & {
  originRiskId?: string;
  originGesId?: string;
  /** Existing PGR facts/assessment, copied without medical inference. */
  originalData?: Record<string, unknown>;
};

const commonSource = {
  title: z.string().trim().min(1).max(200),
  version: z.string().trim().min(1).max(100),
  reference: z.string().trim().min(1).max(2000),
  supersedesSourceId: requiredUuid("Fonte anterior inválida.").optional(),
};
export const medicalSourceInputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("external"),
      ...commonSource,
      risks: medicalRiskListSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("internal"),
      pgrId: requiredUuid("PGR inválido."),
      supersedesSourceId: commonSource.supersedesSourceId,
    })
    .strict(),
]);
export type MedicalSourceInput = z.infer<typeof medicalSourceInputSchema>;
export type SourceFreshness =
  | "current"
  | "changed"
  | "unavailable"
  | "superseded"
  | "external_reference";

/** Never interpret an empty inventory as medical clearance. */
export function medicalSourceWarnings(
  riskCount: number,
  pendingCount: number,
  freshness: SourceFreshness,
): string[] {
  const warnings: string[] = [];
  if (riskCount === 0)
    warnings.push(
      "Fonte sem riscos registrados. Isso não comprova ausência de riscos ocupacionais.",
    );
  if (pendingCount > 0) warnings.push("Há riscos pendentes de revisão técnica.");
  if (freshness === "changed")
    warnings.push("O PGR de origem mudou. Registre uma nova versão e solicite revisão.");
  if (freshness === "unavailable")
    warnings.push(
      "O PGR de origem está indisponível ou sem permissão de acesso. O registro histórico foi preservado.",
    );
  if (freshness === "superseded")
    warnings.push("Esta fonte foi substituída por uma nova versão.");
  if (freshness === "external_reference")
    warnings.push(
      "Fonte externa: alterações no documento original precisam ser registradas como nova versão.",
    );
  return warnings;
}

export function canUseMedicalRisk(
  status: MedicalRiskStatus,
  freshness: SourceFreshness,
): boolean {
  return (
    status === "validated" &&
    (freshness === "current" || freshness === "external_reference")
  );
}
