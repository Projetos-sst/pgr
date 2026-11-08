import { z } from "zod";

import type { ExamProposal } from "./exam-proposal";
import { snapshotSources, type RiskBasisSource } from "./pcmso-signed";
import { OTHER_PROCEDURE_CODE, procedureSelectionSchema } from "./procedure-catalog";

/**
 * Plano de exames por grupo de exposição (NOB-150, MED-15). A equipe prepara o rascunho a
 * partir da proposta (NOB-147); o médico coordenador mantém, retira com justificativa,
 * acrescenta com justificativa, ajusta a periodicidade e aprova. Aprovado não muda: qualquer
 * alteração exige nova versão.
 */
const justification = z
  .string()
  .trim()
  .min(10, "Justifique (mínimo de 10 caracteres).")
  .max(2000, "Máximo de 2000 caracteres.");
const periodicity = z
  .string()
  .trim()
  .min(3, "Informe a periodicidade.")
  .max(1000, "Máximo de 1000 caracteres.");

/** Exame acrescentado pelo médico sempre tem justificativa, inclusive ao mudar só a periodicidade. */
export const ADDED_ITEM_JUSTIFICATION_MESSAGE =
  "Exame acrescentado pelo médico exige justificativa (mínimo de 10 caracteres). Ela não pode ficar em branco ao alterar a decisão ou a periodicidade.";

/** Mesmo exame no mesmo grupo de exposição e função (índice único `uq_exam_plan_items_procedure`). */
export const EXAM_PLAN_ITEM_DUPLICATE_MESSAGE =
  "Este exame já está no plano para este grupo de exposição e função. Altere a decisão do item existente em vez de acrescentá-lo de novo.";

export const itemDecisionSchema = z
  .object({
    decision: z.enum(["kept", "removed"], {
      error: "Escolha manter ou retirar o exame.",
    }),
    periodicity,
    justification: justification.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.decision === "removed" && !value.justification)
      ctx.addIssue({
        code: "custom",
        path: ["justification"],
        message: "Justifique a retirada do exame.",
      });
  });
export type ItemDecisionValues = z.infer<typeof itemDecisionSchema>;

export const addItemSchema = z
  .object({
    exposureGroup: z
      .string()
      .trim()
      .min(1, "Informe o grupo de exposição.")
      .max(500, "Máximo de 500 caracteres."),
    jobRole: z.string().trim().max(500, "Máximo de 500 caracteres.").default(""),
    code: procedureSelectionSchema.shape.code,
    otherDescription: z.string().trim().max(500, "Máximo de 500 caracteres.").optional(),
    periodicity,
    justification,
  })
  .strict()
  .superRefine((value, ctx) => {
    const parsed = procedureSelectionSchema.safeParse({
      code: value.code,
      otherDescription: value.otherDescription,
    });
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  });
export type AddItemValues = z.infer<typeof addItemSchema>;

export const approvePlanSchema = z
  .object({ note: z.string().trim().max(2000, "Máximo de 2000 caracteres.").optional() })
  .strict();
export type ApprovePlanValues = z.infer<typeof approvePlanSchema>;

export type DraftItem = {
  exposureGroup: string;
  jobRole: string;
  procedureCode: string;
  otherDescription: string | null;
  ruleId: string;
  periodicity: string;
};

/** Itens sugeridos do rascunho: um por grupo × função × procedimento da proposta. */
export function draftItemsFromProposal(proposal: ExamProposal): DraftItem[] {
  return proposal.groups.flatMap((group) =>
    group.suggestions.map((suggestion) => ({
      exposureGroup: group.exposureGroup,
      jobRole: group.jobRole ?? "",
      procedureCode: suggestion.procedureCode,
      otherDescription: null,
      ruleId: suggestion.ruleId,
      periodicity: suggestion.periodicity,
    })),
  );
}

/**
 * Riscos utilizáveis da proposta (validados, de fonte vigente e conferível): os que geram sugestão
 * e os sem regra automática. Ids ordenados, sem repetição — o conjunto sobre o qual o médico
 * decide os exames.
 */
export function proposalUsableRiskIds(proposal: ExamProposal): string[] {
  const ids = new Set<string>();
  for (const group of proposal.groups) {
    for (const suggestion of group.suggestions)
      for (const ref of suggestion.triggeredBy) ids.add(ref.riskId);
    for (const ref of group.withoutRule) ids.add(ref.riskId);
  }
  return [...ids].sort();
}

/**
 * Proveniência gravada no plano: de quais fontes e versões a proposta saiu e o conjunto exato de
 * riscos validados (`riskIds`) sobre o qual o médico decidiu. Validar ou rejeitar um risco na
 * mesma fonte (mesmo id e versão) muda o conjunto e desatualiza o plano.
 */
export function basedOnFromProposal(proposal: ExamProposal) {
  return {
    sources: proposal.basis.map(({ id, kind, title, version, freshness }) => ({
      id,
      kind,
      title,
      version,
      freshness,
    })),
    riskIds: proposalUsableRiskIds(proposal),
    excluded: {
      pending: proposal.excluded.pending.length,
      rejected: proposal.excluded.rejected.length,
      outdated: proposal.excluded.outdated.length,
    },
    withoutRule: proposal.groups.reduce((n, g) => n + g.withoutRule.length, 0),
  };
}

/**
 * Conjunto de riscos gravado no plano (`based_on.riskIds`), ordenado. `null` = plano anterior a
 * esse controle (legado): só as fontes podem ser conferidas.
 */
export function planRiskIds(basedOn: unknown): string[] | null {
  const ids = (basedOn as { riskIds?: unknown } | null)?.riskIds;
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) return null;
  return [...new Set(ids as string[])].sort();
}

export const sameRiskIds = (a: readonly string[], b: readonly string[]) =>
  [...new Set(a)].sort().join("|") === [...new Set(b)].sort().join("|");

/**
 * Plano × base de riscos vigente:
 * - `current`: mesmas fontes e versões e mesmo conjunto de riscos validados;
 * - `outdated`: fonte, versão ou conjunto de riscos mudou desde o plano;
 * - `legacy`: fontes conferem, mas o plano não gravou o conjunto de riscos (anterior ao controle).
 */
export type PlanBasisStatus = "current" | "outdated" | "legacy";

export function planBasisStatus(
  basedOn: unknown,
  live: { sources: readonly RiskBasisSource[]; riskIds: readonly string[] },
): PlanBasisStatus {
  const sources = snapshotSources((basedOn as { sources?: unknown } | null)?.sources);
  const key = (list: readonly RiskBasisSource[]) =>
    list
      .map((s) => `${s.id}@${s.version}`)
      .sort()
      .join("|");
  if (!sources || key(sources) !== key(live.sources)) return "outdated";
  const riskIds = planRiskIds(basedOn);
  if (riskIds === null) return "legacy";
  return sameRiskIds(riskIds, live.riskIds) ? "current" : "outdated";
}

export type StalePlanBasis = Exclude<PlanBasisStatus, "current">;
export const EXAM_PLAN_BASIS_MESSAGES: Record<StalePlanBasis, string> = {
  outdated:
    "Os riscos validados mudaram desde que este rascunho foi preparado (fonte, versão ou validação de risco): ele não pode ser aprovado. Prepare novo rascunho a partir dos riscos atuais; o desatualizado é arquivado.",
  legacy:
    "Este rascunho é anterior ao controle do conjunto de riscos validados e não pode ser aprovado. Prepare novo rascunho a partir dos riscos atuais; o anterior é arquivado.",
};

export const isOtherProcedure = (code: string) => code === OTHER_PROCEDURE_CODE;
