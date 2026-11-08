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
    // Mesmas regras de antes; só as mensagens em português (o padrão do Zod vazava em inglês).
    agentType: z.enum(riskAgentTypeSchema.options, {
      error: "Selecione a categoria do risco.",
    }),
    description: z
      .string()
      .trim()
      .min(1, "Descreva o risco.")
      .max(5000, "Máximo de 5.000 caracteres."),
    exposureGroup: z
      .string()
      .trim()
      .min(1, "Informe o grupo ou contexto de exposição.")
      .max(500, "Máximo de 500 caracteres."),
    jobRole: z.string().trim().max(500, "Máximo de 500 caracteres.").optional(),
    possibleInjuries: z.string().trim().max(5000, "Máximo de 5.000 caracteres.").optional(),
    exposureDescription: z
      .string()
      .trim()
      .max(5000, "Máximo de 5.000 caracteres.")
      .optional(),
    /**
     * Código do agente nocivo (Tabela 24 do eSocial) **como informado no PGR externo** (NOB-111).
     * Só formato; fica pendente de validação como o resto do risco. Ausente → o coordenador define
     * os exames (nunca é inventado).
     */
    noxiousAgentCode: z
      .string()
      .trim()
      .regex(
        /^\d{2}\.\d{2}\.\d{3}$/,
        "Código do agente nocivo no formato da Tabela 24 (ex.: 02.01.001).",
      )
      .optional(),
  })
  .strict();
export type MedicalRiskContent = z.infer<typeof medicalRiskContentSchema>;
export const medicalRiskListSchema = z
  .array(medicalRiskContentSchema)
  .max(500, "Máximo de 500 riscos por fonte.");
export type MedicalRiskSnapshot = MedicalRiskContent & {
  originRiskId?: string;
  originGesId?: string;
  /** Existing PGR facts/assessment, copied without medical inference. */
  originalData?: Record<string, unknown>;
};

const commonSource = {
  title: z
    .string({ error: "Informe o título da fonte." })
    .trim()
    .min(1, "Informe o título da fonte.")
    .max(200, "Máximo de 200 caracteres."),
  version: z
    .string({ error: "Informe a versão do documento." })
    .trim()
    .min(1, "Informe a versão do documento.")
    .max(100, "Máximo de 100 caracteres."),
  reference: z
    .string({ error: "Identifique o documento: título, revisão e onde está arquivado." })
    .trim()
    .min(5, "Identifique o documento: título, revisão e onde está arquivado.")
    .max(2000, "Máximo de 2.000 caracteres."),
  supersedesSourceId: requiredUuid("Fonte anterior inválida.").optional(),
};
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
/** Proveniência do PGR externo (NOB-111), só o que o documento informa. */
const externalProvenance = {
  documentDate: isoDate.optional(),
  preparedBy: z
    .string()
    .trim()
    .min(1, "Informe o responsável pela elaboração.")
    .max(300, "Máximo de 300 caracteres.")
    .optional(),
  reviewDueOn: isoDate.optional(),
};
export const medicalSourceInputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("external"),
      ...commonSource,
      ...externalProvenance,
      risks: medicalRiskListSchema,
    })
    .strict()
    .refine((v) => !v.reviewDueOn || !v.documentDate || v.reviewDueOn >= v.documentDate, {
      message: "A data de revisão não pode ser anterior à data do documento.",
      path: ["reviewDueOn"],
    }),
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
  external?: { documentDate: string | null; reviewDueOn: string | null; today: string },
): string[] {
  const warnings: string[] = [];
  if (external && freshness === "external_reference") {
    if (!external.documentDate)
      warnings.push(
        "Data do documento externo não informada: confira a versão com a empresa.",
      );
    if (external.reviewDueOn && external.reviewDueOn < external.today)
      warnings.push(
        `A data de revisão informada no PGR externo (${external.reviewDueOn}) já passou: registre a versão revisada como nova fonte.`,
      );
  }
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

export type MedicalSourceStatus =
  | "registered_without_risks"
  | "awaiting_validation"
  | "validated"
  | "rejected"
  | "superseded"
  | "origin_changed";
export const MEDICAL_SOURCE_STATUS_LABELS: Record<MedicalSourceStatus, string> = {
  registered_without_risks: "Fonte cadastrada, sem riscos registrados",
  awaiting_validation: "Aguardando validação técnica",
  validated: "Fonte validada",
  rejected: "Fonte rejeitada",
  superseded: "Fonte substituída por nova versão",
  origin_changed: "PGR de origem alterado: registrar nova versão",
};

/**
 * Situação da fonte, derivada dos riscos (nunca gravada): só é "validada" quando nenhum risco está
 * pendente e ao menos um foi validado por profissional autorizado; todos rejeitados = rejeitada.
 */
export function medicalSourceStatus(
  statuses: readonly MedicalRiskStatus[],
  freshness: SourceFreshness,
): MedicalSourceStatus {
  if (freshness === "superseded") return "superseded";
  if (freshness === "changed" || freshness === "unavailable") return "origin_changed";
  if (statuses.length === 0) return "registered_without_risks";
  if (statuses.includes("pending")) return "awaiting_validation";
  return statuses.includes("validated") ? "validated" : "rejected";
}

/** Rótulo da origem dos riscos no PCMSO (NOB-111). */
export function riskOriginLabel(kind: "internal" | "external" | string): string {
  return kind === "external" ? "PGR externo validado" : "PGR interno";
}
