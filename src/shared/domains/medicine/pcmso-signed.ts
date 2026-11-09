import { z } from "zod";

import {
  compareProfessionalRegistration,
  signerRegistrationSchema,
} from "@/shared/domains/pgr/medicos";

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
    // Separadores tolerados; a conferência com o cadastro usa a forma canônica (NOB-110).
    signerRegistration: signerRegistrationSchema,
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

/**
 * Médico responsável impresso na prévia (`content.coordinator`): CRM e UF como estavam no cadastro
 * na geração e início da designação. `null` se a prévia não traz o bloco legível.
 */
export type PreviewCoordinator = {
  crm: string;
  registrationUf: string | null;
  startsOn: string | null;
};
export function previewCoordinator(content: unknown): PreviewCoordinator | null {
  const c = (content as { coordinator?: unknown } | null)?.coordinator as
    | Record<string, unknown>
    | null
    | undefined;
  if (!c || typeof c.crm !== "string" || c.crm.trim() === "") return null;
  return {
    crm: c.crm,
    registrationUf: typeof c.registrationUf === "string" ? c.registrationUf : null,
    startsOn: typeof c.startsOn === "string" ? c.startsOn : null,
  };
}

/** A prévia nomeia um médico responsável e outro assina: nunca vira o PCMSO vigente. */
export const PREVIEW_NAMES_OTHER_COORDINATOR_MESSAGE =
  "A prévia nomeia outro médico responsável; gere nova prévia com o médico responsável em vigor e colha a assinatura dele.";

export type PcmsoSignedWarning =
  | "signed_current_ambiguous"
  | "risk_basis_changed"
  | "newer_preview"
  | "plan_changed"
  | "coordinator_changed"
  | "preview_coordinator_mismatch"
  | "cycle_ended";
export const PCMSO_SIGNED_WARNING_LABELS: Record<PcmsoSignedWarning, string> = {
  signed_current_ambiguous:
    "Há mais de um PCMSO assinado vigente (registro anterior à regra de vigência única). O sistema não escolhe um deles: nova versão fica bloqueada até a regularização por pessoa autorizada.",
  risk_basis_changed:
    "Os riscos ou as fontes de riscos mudaram depois da prévia assinada: o programa precisa de nova conferência, nova prévia e nova versão assinada.",
  newer_preview:
    "Há prévia mais recente que a assinada: o documento vigente pode estar desatualizado.",
  plan_changed:
    "O plano de exames aprovado mudou depois da assinatura: o programa precisa de nova versão assinada.",
  coordinator_changed:
    "O médico responsável designado mudou: registre a nova versão (alteração administrativa).",
  preview_coordinator_mismatch:
    "A prévia assinada nomeia outro médico responsável que não o signatário: gere nova prévia com o médico responsável em vigor e registre a nova versão assinada por ele.",
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
    /**
     * Médico responsável impresso na prévia assinada. Ausente = não conferido; `null` = prévia sem
     * o bloco legível (conta como divergente).
     */
    previewCoordinator?: { crm: string; registrationUf: string | null } | null;
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
  // Mesma conferência tolerante a formatação do registro (NOB-110): reformatar o CRM no cadastro
  // não é troca de coordenador.
  if (
    !input.coordinator ||
    compareProfessionalRegistration(input.coordinator, {
      registration: c.signerRegistration,
      uf: c.signerUf,
    }) !== "match"
  )
    out.push("coordinator_changed");
  // Documento registrado antes da conferência "prévia nomeia quem assina": sinaliza, sem reescrever.
  if (
    c.previewCoordinator !== undefined &&
    (!c.previewCoordinator ||
      compareProfessionalRegistration(
        { crm: c.previewCoordinator.crm, uf: c.previewCoordinator.registrationUf },
        { registration: c.signerRegistration, uf: c.signerUf },
      ) !== "match")
  )
    out.push("preview_coordinator_mismatch");
  if (input.today > c.cycleEnd) out.push("cycle_ended");
  return out;
}

// ── Base de riscos do documento × riscos vigentes (NR-7 7.5.1, 7.5.5; SEG-21) ──

export type RiskBasisSource = { id: string; version: string };
export type RiskBasisRisk = {
  exposureGroup: string;
  jobRole: string;
  description: string;
  agentType: string;
  possibleInjuries: string | null;
};

export type RiskBasisProblem =
  | "no_live_source"
  | "source_changed"
  | "preview_sources_mismatch"
  | "plan_sources_mismatch"
  | "plan_risks_mismatch"
  | "preview_risks_mismatch"
  | "basis_changed_since_preview";

export const RISK_BASIS_PROBLEM_MESSAGES: Record<RiskBasisProblem, string> = {
  no_live_source:
    "Não há fonte de riscos vigente que possa ser conferida para a empresa: o PCMSO não é registrado como vigente.",
  source_changed:
    "O PGR de origem mudou ou ficou indisponível depois do registro da fonte: registre a nova versão da fonte, valide os riscos e gere nova prévia.",
  preview_sources_mismatch:
    "A prévia foi composta sobre outra fonte ou versão de riscos: gere nova prévia a partir das fontes vigentes.",
  plan_sources_mismatch:
    "O plano de exames aprovado foi feito sobre outra fonte ou versão de riscos: revalide o plano com o médico responsável e gere nova prévia.",
  plan_risks_mismatch:
    "Os riscos validados mudaram desde o plano de exames aprovado (risco validado ou rejeitado depois da aprovação): revalide o plano com o médico responsável e gere nova prévia.",
  preview_risks_mismatch:
    "Os riscos validados da empresa mudaram depois da prévia: gere nova prévia (e revalide o plano, se necessário).",
  basis_changed_since_preview:
    "A base de riscos (fontes, situação dos riscos ou conteúdo do PGR) mudou depois da prévia, ou a prévia é anterior a esse controle: gere nova prévia.",
};

/** Fontes (id e versão) gravadas num snapshot (`content.riskBasis.sources` ou `based_on.sources`). */
export function snapshotSources(sources: unknown): RiskBasisSource[] | null {
  if (!Array.isArray(sources)) return null;
  const out: RiskBasisSource[] = [];
  for (const s of sources) {
    const id = (s as { id?: unknown })?.id;
    const version = (s as { version?: unknown })?.version;
    if (typeof id !== "string" || typeof version !== "string") return null;
    out.push({ id, version });
  }
  return out;
}

/** Riscos impressos na prévia (`content.groups[].risks`), na forma usada para comparar. */
export function previewRisks(content: unknown): RiskBasisRisk[] | null {
  const groups = (content as { groups?: unknown })?.groups;
  if (!Array.isArray(groups)) return null;
  return groups.flatMap((g) => {
    const group = g as {
      exposureGroup?: string;
      jobRole?: string;
      risks?: {
        description: string;
        agentType: string;
        possibleInjuries: string | null;
      }[];
    };
    return (group.risks ?? []).map((r) => ({
      exposureGroup: group.exposureGroup ?? "",
      jobRole: group.jobRole ?? "",
      description: r.description,
      agentType: r.agentType,
      possibleInjuries: r.possibleInjuries ?? null,
    }));
  });
}

const sourceKey = (list: RiskBasisSource[]) =>
  list
    .map((s) => `${s.id}@${s.version}`)
    .sort()
    .join("|");
const riskKey = (list: RiskBasisRisk[]) =>
  list
    .map((r) =>
      JSON.stringify([
        r.exposureGroup,
        r.jobRole,
        r.description,
        r.agentType,
        r.possibleInjuries,
      ]),
    )
    .sort()
    .join("\n");

const idSetKey = (ids: readonly string[]) => [...new Set(ids)].sort().join("|");

/**
 * Compara a base de riscos que fundamentou o documento (prévia e plano) com a vigente. Falha
 * fechada: snapshot ilegível, nenhuma fonte vigente ou fonte não conferível contam como problema.
 * Não classifica mudança clínica: qualquer divergência de versão ou de riscos exige nova conferência.
 */
export function riskBasisProblems(input: {
  live: RiskBasisSource[];
  liveFresh: boolean;
  liveRisks: RiskBasisRisk[];
  previewSources: RiskBasisSource[] | null;
  planSources: RiskBasisSource[] | null;
  previewRisks: RiskBasisRisk[] | null;
  /**
   * Conjunto de riscos validados gravado no plano aprovado (`based_on.riskIds`) e o vigente.
   * Plano legado (sem o conjunto, `null`) só é conferido pelas fontes.
   */
  planRiskIds?: string[] | null;
  liveRiskIds?: string[];
  /** Resumo da base calculado no banco: o gravado na prévia e o atual (nulo = sem controle). */
  previewDigest?: string | null;
  currentDigest?: string | null;
}): RiskBasisProblem[] {
  const out: RiskBasisProblem[] = [];
  if (!input.live.length) out.push("no_live_source");
  if (!input.liveFresh) out.push("source_changed");
  const live = sourceKey(input.live);
  if (!input.previewSources || sourceKey(input.previewSources) !== live)
    out.push("preview_sources_mismatch");
  if (!input.planSources || sourceKey(input.planSources) !== live)
    out.push("plan_sources_mismatch");
  if (
    Array.isArray(input.planRiskIds) &&
    input.liveRiskIds !== undefined &&
    idSetKey(input.planRiskIds) !== idSetKey(input.liveRiskIds)
  )
    out.push("plan_risks_mismatch");
  if (!input.previewRisks || riskKey(input.previewRisks) !== riskKey(input.liveRisks))
    out.push("preview_risks_mismatch");
  if (
    input.previewDigest !== undefined &&
    (!input.previewDigest || input.previewDigest !== input.currentDigest)
  )
    out.push("basis_changed_since_preview");
  return out;
}
