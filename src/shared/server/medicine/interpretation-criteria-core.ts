import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { getExamPlan, listExamPlans } from "@/shared/db/repositories/medical-exam-plans";
import * as repo from "@/shared/db/repositories/pcmso-interpretation-criteria";
import {
  criteriaCoverage,
  interpretationCriteriaInputSchema,
  type CurrentCriterion,
} from "@/shared/domains/medicine/interpretation-criteria";
import { procedureSelectionSchema } from "@/shared/domains/medicine/procedure-catalog";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";

const companyUuid = (id: string) => requiredUuid("Empresa inválida.").parse(id);

const toCurrent = (row: repo.CriterionRow): CurrentCriterion => ({
  id: row.id,
  procedureCode: row.procedureCode,
  otherDescription: row.otherDescription,
  version: row.version,
  criteria: row.criteria,
  conduct: row.conduct,
  authorName: row.authorName ?? "",
  authoredAt: new Date(row.authoredAt).toISOString(),
});

/** Critérios vigentes da empresa, no formato usado pela composição e pela conferência. */
export async function currentCriteria(ctx: TenantContext, companyId: string) {
  return (await repo.listCurrentCriteria(ctx, companyUuid(companyId))).map(toCurrent);
}

/** Exames mantidos no plano aprovado; `null` sem plano aprovado. */
export async function approvedPlannedProcedures(ctx: TenantContext, companyId: string) {
  const plans = await listExamPlans(ctx, companyUuid(companyId));
  const approved = plans.find((plan) => plan.status === "approved");
  if (!approved) return null;
  const plan = await getExamPlan(ctx, approved.id);
  return {
    version: plan.version,
    items: plan.items
      .filter((item) => item.decision === "kept")
      .map((item) => ({
        procedureCode: item.procedureCode,
        otherDescription: item.otherDescription,
      })),
  };
}

/** Exames do plano aprovado com o critério vigente de cada um, mais os sem critério. */
export async function listCriteria(ctx: TenantContext, companyId: string) {
  const [planned, current] = await Promise.all([
    approvedPlannedProcedures(ctx, companyId),
    currentCriteria(ctx, companyId),
  ]);
  return {
    approvedPlanVersion: planned?.version ?? null,
    ...criteriaCoverage(planned?.items ?? [], current),
  };
}

/** Histórico (todas as versões) dos critérios de um procedimento. */
export async function criteriaHistory(
  ctx: TenantContext,
  companyId: string,
  code: string,
) {
  const parsed = procedureSelectionSchema.shape.code.parse(code);
  return (await repo.listCriteriaHistory(ctx, companyUuid(companyId), parsed)).map(
    toCurrent,
  );
}

/** Nova versão do critério, só pelo coordenador vinculado (NOB-149). */
export async function defineCriteria(
  ctx: TenantContext,
  companyId: string,
  input: unknown,
) {
  const values = interpretationCriteriaInputSchema.parse(input);
  return repo.insertCriterion(ctx, companyUuid(companyId), values);
}
