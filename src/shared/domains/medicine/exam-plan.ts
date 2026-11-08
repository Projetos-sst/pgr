import { z } from "zod";

import type { ExamProposal } from "./exam-proposal";
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
    decision: z.enum(["kept", "removed"]),
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
    exposureGroup: z.string().trim().min(1, "Informe o grupo de exposição.").max(500),
    jobRole: z.string().trim().max(500).default(""),
    code: procedureSelectionSchema.shape.code,
    otherDescription: z.string().trim().max(500).optional(),
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

/** Proveniência gravada no plano: de quais fontes e versões a proposta saiu. */
export function basedOnFromProposal(proposal: ExamProposal) {
  return {
    sources: proposal.basis.map(({ id, kind, title, version, freshness }) => ({
      id,
      kind,
      title,
      version,
      freshness,
    })),
    excluded: {
      pending: proposal.excluded.pending.length,
      rejected: proposal.excluded.rejected.length,
      outdated: proposal.excluded.outdated.length,
    },
    withoutRule: proposal.groups.reduce((n, g) => n + g.withoutRule.length, 0),
  };
}

export const isOtherProcedure = (code: string) => code === OTHER_PROCEDURE_CODE;
