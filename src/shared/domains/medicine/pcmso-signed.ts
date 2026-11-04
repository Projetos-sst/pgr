import { z } from "zod";

/**
 * PCMSO assinado arquivado (NOB-166; MED-02, MED-11, MED-12, MED-14).
 *
 * - A NR-7 atribui ao médico responsável a elaboração e a responsabilidade pelo PCMSO (7.4.1 "c",
 *   7.5.4). A NR-7 não traz, para o PCMSO, uma exigência de assinatura documental idêntica à do
 *   ASO (7.5.19.1 "g"): o fluxo de assinatura e arquivo vem do requisito aprovado em MED-12.
 * - A versão oficial é o PDF de uma prévia do sistema assinado pelo coordenador designado.
 * - A conferência registrada é **documental** (relatório do validador ou guarda do original físico).
 *   O sistema não valida assinatura criptograficamente e nunca rotula o documento como
 *   "assinatura digital validada".
 * - Tipos de mudança (MED-14): troca de coordenador é alteração administrativa, não revisão clínica.
 */

export const PCMSO_SIGNED_ORIGINS = ["coordinator", "office_received"] as const;
export const PCMSO_SIGNATURE_METHODS = [
  "icp_brasil",
  "electronic",
  "handwritten",
] as const;
export const PCMSO_CHANGE_KINDS = [
  "administrative",
  "documentary_update",
  "clinical_revision",
  "correction",
] as const;
export type PcmsoSignedOriginValue = (typeof PCMSO_SIGNED_ORIGINS)[number];
export type PcmsoSignatureMethodValue = (typeof PCMSO_SIGNATURE_METHODS)[number];
export type PcmsoChangeKindValue = (typeof PCMSO_CHANGE_KINDS)[number];

export const PCMSO_SIGNED_ORIGIN_LABELS: Record<PcmsoSignedOriginValue, string> = {
  coordinator: "Médico responsável, pela conta vinculada e verificada",
  office_received:
    "Equipe do escritório, arquivando o documento assinado pelo médico responsável",
};
export const PCMSO_SIGNATURE_METHOD_LABELS: Record<PcmsoSignatureMethodValue, string> = {
  icp_brasil: "Certificado digital ICP-Brasil",
  electronic: "Plataforma de assinatura eletrônica",
  handwritten: "Assinatura manual (original físico digitalizado)",
};
export const PCMSO_VERIFICATION_HINTS: Record<PcmsoSignatureMethodValue, string> = {
  icp_brasil:
    "Referência do relatório do validador consultado (ex.: Verificador ITI). A conferência é documental: o sistema não valida o certificado.",
  electronic:
    "Código ou link de verificação da plataforma de assinatura, conferido por quem registra.",
  handwritten: "Onde o original físico assinado está guardado e quem o conferiu.",
};
export const PCMSO_CHANGE_KIND_LABELS: Record<PcmsoChangeKindValue, string> = {
  administrative: "Alteração administrativa (ex.: troca do médico responsável)",
  documentary_update: "Atualização documental (dados cadastrais, sem mudança clínica)",
  clinical_revision: "Revisão clínica do programa (riscos, exames ou periodicidade)",
  correction: "Correção do documento assinado anterior",
};
export const PCMSO_VERIFICATION_LABEL =
  "Assinatura conferida documentalmente (sem validação criptográfica pelo sistema)";

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null))
  .pipe(z.uuid("Identificador inválido.").nullable());

export const pcmsoSignedInputSchema = z
  .object({
    origin: z.enum(PCMSO_SIGNED_ORIGINS, { error: "Informe quem registra o documento." }),
    previewDocumentId: z.uuid("Informe a prévia do sistema que foi assinada."),
    signatureMethod: z.enum(PCMSO_SIGNATURE_METHODS, {
      error: "Informe o método de assinatura.",
    }),
    verificationReference: z
      .string()
      .trim()
      .min(5, "Informe a conferência da assinatura (mínimo de 5 caracteres).")
      .max(500, "Máximo de 500 caracteres."),
    signerName: z
      .string()
      .trim()
      .min(3, "Informe o nome do médico que assinou.")
      .max(200, "Máximo de 200 caracteres."),
    signerRegistration: z
      .string()
      .trim()
      .regex(/^\d{1,10}$/, "CRM do signatário: só números."),
    signerUf: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "UF do CRM do signatário inválida."),
    signedOn: z.iso.date("Data da assinatura inválida."),
    replacesId: optionalUuid,
    changeKind: z
      .enum(PCMSO_CHANGE_KINDS)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    replaceReason: z.string().trim().max(1000, "Máximo de 1.000 caracteres.").optional(),
  })
  .superRefine((v, ctx) => {
    if (v.replacesId) {
      if (!v.changeKind)
        ctx.addIssue({
          code: "custom",
          path: ["changeKind"],
          message: "Informe o tipo de mudança da nova versão.",
        });
      if (!v.replaceReason || v.replaceReason.length < 10)
        ctx.addIssue({
          code: "custom",
          path: ["replaceReason"],
          message:
            "Explique em pelo menos 10 caracteres por que o documento é substituído.",
        });
    } else if (v.changeKind || v.replaceReason)
      ctx.addIssue({
        code: "custom",
        path: ["replaceReason"],
        message: "Tipo de mudança e motivo só valem para substituição.",
      });
  })
  .transform((v) => ({
    ...v,
    changeKind: v.replacesId ? (v.changeKind ?? null) : null,
    replaceReason: v.replacesId ? (v.replaceReason ?? null) : null,
  }));

export type PcmsoSignedInput = z.output<typeof pcmsoSignedInputSchema>;

/** Data da assinatura: não futura, não anterior à prévia nem à designação, e dentro do ciclo. */
export function pcmsoSignedOnProblem(input: {
  signedOn: string;
  previewGeneratedOn: string;
  coordinatorStartsOn: string;
  cycleEnd: string;
  today: string;
}): string | null {
  const { signedOn } = input;
  if (signedOn > input.today) return "A data da assinatura não pode ser futura.";
  if (signedOn < input.previewGeneratedOn)
    return "A data da assinatura não pode ser anterior à geração da prévia assinada.";
  if (signedOn < input.coordinatorStartsOn)
    return "A data da assinatura é anterior à designação do médico responsável.";
  if (signedOn > input.cycleEnd)
    return "A data da assinatura é posterior ao fim do ciclo do PCMSO: gere a prévia do novo ciclo.";
  return null;
}

export type PcmsoSignedWarning =
  | "newer_preview"
  | "plan_changed"
  | "coordinator_changed"
  | "cycle_ended";
export const PCMSO_SIGNED_WARNING_LABELS: Record<PcmsoSignedWarning, string> = {
  newer_preview:
    "Há prévia mais recente que a assinada: o documento vigente pode estar desatualizado.",
  plan_changed:
    "O plano de exames aprovado mudou depois da assinatura: o programa precisa de nova versão assinada.",
  coordinator_changed:
    "O médico responsável designado mudou: registre a nova versão (alteração administrativa).",
  cycle_ended: "O ciclo do PCMSO assinado terminou.",
};

/** Alertas de desatualização do PCMSO assinado vigente (derivados, nunca reescrevem o documento). */
export function pcmsoSignedWarnings(input: {
  current: {
    previewVersion: number;
    examPlanId: string;
    signerRegistration: string;
    signerUf: string;
    cycleEnd: string;
  } | null;
  latestPreviewVersion: number | null;
  approvedPlanId: string | null;
  coordinator: { crm: string; uf: string | null } | null;
  today: string;
}): PcmsoSignedWarning[] {
  const c = input.current;
  if (!c) return [];
  const out: PcmsoSignedWarning[] = [];
  if (
    input.latestPreviewVersion !== null &&
    input.latestPreviewVersion > c.previewVersion
  )
    out.push("newer_preview");
  if (input.approvedPlanId !== c.examPlanId) out.push("plan_changed");
  if (
    !input.coordinator ||
    input.coordinator.crm !== c.signerRegistration ||
    input.coordinator.uf !== c.signerUf
  )
    out.push("coordinator_changed");
  if (input.today > c.cycleEnd) out.push("cycle_ended");
  return out;
}
