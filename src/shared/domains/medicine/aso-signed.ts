import { z } from "zod";

import { signerRegistrationSchema } from "@/shared/domains/pgr/medicos";

/**
 * ASO assinado arquivado (NOB-163; MED-01, MED-11, MED-12; NR-7 7.5.19.1 "g").
 *
 * - O ASO oficial é o PDF assinado pelo médico examinador. O sistema não assina e não presume
 *   assinatura: quem registra informa o método e a conferência feita.
 * - Fluxo A (`examiner`): o examinador do exame, com identidade verificada, registra o PDF assinado
 *   a partir de uma prévia do sistema; signatário e conclusão precisam bater com o exame e a prévia.
 * - Fluxo B (`external_clinic`): a equipe do escritório arquiva o ASO assinado entregue pela clínica
 *   externa, com o signatário como consta no documento.
 * - Correção = nova versão que substitui a anterior, com motivo; a anterior é preservada.
 */

export const ASO_SIGNED_ORIGINS = ["examiner", "external_clinic"] as const;
export const ASO_SIGNATURE_METHODS = ["icp_brasil", "electronic", "handwritten"] as const;
export type AsoSignedOriginValue = (typeof ASO_SIGNED_ORIGINS)[number];
export type AsoSignatureMethodValue = (typeof ASO_SIGNATURE_METHODS)[number];

export const ASO_SIGNED_ORIGIN_LABELS: Record<AsoSignedOriginValue, string> = {
  examiner: "Médico examinador (a partir da prévia do sistema)",
  external_clinic: "Clínica externa",
};

export const ASO_SIGNATURE_METHOD_LABELS: Record<AsoSignatureMethodValue, string> = {
  icp_brasil: "Assinatura digital ICP-Brasil",
  electronic: "Assinatura eletrônica em plataforma",
  handwritten: "Assinatura manual (original físico digitalizado)",
};

/** O que a referência de conferência precisa conter, conforme o método. */
export const ASO_VERIFICATION_HINTS: Record<AsoSignatureMethodValue, string> = {
  icp_brasil:
    "Referência do relatório do validador oficial (ex.: Verificador de Conformidade do ITI) que confirmou a assinatura.",
  electronic:
    "Referência da verificação na própria plataforma de assinatura (código ou link de verificação).",
  handwritten: "Onde o original físico assinado está guardado (local e identificação).",
};

export const ASO_SIGNED_CONCLUSION_LABELS = {
  fit: "Apto para a função",
  unfit: "Inapto para a função",
} as const;

/**
 * Fluxo A: a prévia assinada precisa ser a mais recente do exame e ainda corresponder à composição
 * atual (mesmo SHA-256, sem bloqueio na conferência). Espelha a regra do PCMSO assinado.
 */
export const ASO_SIGNED_PREVIEW_STALE_MESSAGE =
  "A prévia escolhida não corresponde mais ao exame (ou não é a mais recente). Gere uma nova prévia e assine-a.";

/** O ASO assinado vigente não corresponde mais ao exame (correção por substituição, MED-11). */
export const ASO_SIGNED_OUTDATED_MESSAGE =
  "Os dados do exame mudaram depois do ASO assinado vigente. Gere nova prévia, colha a assinatura e registre a substituição.";

/** Limite do PDF (mesmo teto do GED). */
export const ASO_SIGNED_MAX_BYTES = 25 * 1024 * 1024;

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null))
  .pipe(z.uuid("Identificador inválido.").nullable());

export const asoSignedInputSchema = z
  .object({
    origin: z.enum(ASO_SIGNED_ORIGINS, { error: "Informe a origem do ASO assinado." }),
    previewDocumentId: optionalUuid,
    signatureMethod: z.enum(ASO_SIGNATURE_METHODS, {
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
    // Separadores tolerados; a conferência com o cadastro usa a forma canônica (NOB-110).
    signerRegistration: signerRegistrationSchema,
    signerUf: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "UF do CRM do signatário inválida."),
    conclusion: z.enum(["fit", "unfit"], {
      error: "Informe a conclusão do documento: apto ou inapto.",
    }),
    signedOn: z.iso.date("Data da assinatura inválida."),
    replacesId: optionalUuid,
    replaceReason: z
      .string()
      .trim()
      .max(1000, "Máximo de 1.000 caracteres.")
      .optional()
      .default(""),
  })
  .superRefine((v, ctx) => {
    if (v.origin === "examiner" && !v.previewDocumentId)
      ctx.addIssue({
        code: "custom",
        path: ["previewDocumentId"],
        message: "No fluxo do examinador, informe a prévia do sistema que foi assinada.",
      });
    if (v.origin === "external_clinic" && v.previewDocumentId)
      ctx.addIssue({
        code: "custom",
        path: ["previewDocumentId"],
        message: "ASO de clínica externa não usa prévia do sistema.",
      });
    if (v.replacesId && v.replaceReason.length < 10)
      ctx.addIssue({
        code: "custom",
        path: ["replaceReason"],
        message:
          "Explique em pelo menos 10 caracteres por que o documento é substituído.",
      });
    if (!v.replacesId && v.replaceReason)
      ctx.addIssue({
        code: "custom",
        path: ["replaceReason"],
        message: "Motivo só vale para substituição.",
      });
  })
  .transform((v) => ({ ...v, replaceReason: v.replacesId ? v.replaceReason : null }));

export type AsoSignedInput = z.output<typeof asoSignedInputSchema>;

/** Confere tamanho e cabeçalho do PDF (o tipo informado pelo navegador não basta). */
export function checkSignedPdf(
  bytes: Uint8Array,
): { ok: true } | { ok: false; message: string } {
  if (bytes.byteLength === 0) return { ok: false, message: "Envie o PDF assinado." };
  if (bytes.byteLength > ASO_SIGNED_MAX_BYTES)
    return { ok: false, message: "O PDF passa do limite de 25 MB." };
  const header = String.fromCharCode(...bytes.slice(0, 5));
  if (header !== "%PDF-") return { ok: false, message: "O arquivo precisa ser um PDF." };
  return { ok: true };
}

/** Data da assinatura: não futura e não anterior ao exame. */
export function signedOnProblem(
  signedOn: string,
  performedAt: string,
  today: string,
): string | null {
  if (signedOn > today) return "A data da assinatura não pode ser futura.";
  if (signedOn < performedAt)
    return "A data da assinatura não pode ser anterior à data do exame.";
  return null;
}

export type AsoSignedItem = {
  id: string;
  origin: AsoSignedOriginValue;
  previewDocumentId: string | null;
  signatureMethod: AsoSignatureMethodValue;
  verificationReference: string;
  signerName: string;
  signerRegistration: string;
  signerUf: string;
  conclusion: "fit" | "unfit";
  signedOn: string;
  fileSha256: string;
  sizeBytes: number;
  replacesId: string | null;
  replaceReason: string | null;
  registeredBy: string;
  registeredAt: string;
  /** Substituído por outro documento (não é mais o ASO vigente do exame). */
  replacedById: string | null;
  /**
   * Só no vigente, na listagem do exame: os dados do exame mudaram depois da assinatura (ver
   * `signedAsoOutdated`). Aviso; não bloqueia edição nem substituição (MED-11).
   */
  outdated?: boolean;
};

/**
 * O ASO assinado vigente ainda corresponde ao exame? Fluxo A: a prévia assinada precisa ter o
 * SHA-256 da composição atual (sem prévia possível hoje = divergente). Fluxo B (sem prévia): só a
 * conclusão é comparável; diverge quando o exame tem apto/inapto efetivo diferente do documento.
 * "Apto com restrição" sem confirmação do examinador não tem conclusão efetiva: nada é inferido.
 */
export function signedAsoOutdated(
  signed: Pick<AsoSignedItem, "origin" | "conclusion">,
  now: {
    /** SHA-256 da prévia assinada (fluxo A). */
    previewSha256: string | null;
    /** SHA-256 da composição atual; `null` com bloqueio na conferência. */
    currentSha256: string | null;
    /** Apto/inapto efetivo do exame hoje; `null` sem conclusão. */
    conclusion: "fit" | "unfit" | null;
  },
): boolean {
  if (signed.origin === "examiner")
    return !now.previewSha256 || now.previewSha256 !== now.currentSha256;
  return now.conclusion !== null && now.conclusion !== signed.conclusion;
}

/**
 * O ASO vigente do exame: o documento que ninguém substituiu. O registro garante uma cadeia só por
 * exame (novo documento com vigente existente precisa substituí-lo).
 */
export function currentSignedAso<T extends { id: string; replacesId: string | null }>(
  items: T[],
): T | null {
  const replaced = new Set(items.map((i) => i.replacesId).filter(Boolean));
  return items.find((i) => !replaced.has(i.id)) ?? null;
}
