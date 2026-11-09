import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as repo from "@/shared/db/repositories/medical-exam-plans";
import { isActorCompanyCoordinator } from "@/shared/db/repositories/medico-user-links";
import {
  addItemSchema,
  approvePlanSchema,
  basedOnFromProposal,
  draftItemsFromProposal,
  itemDecisionSchema,
  planBasisStatus,
  proposalUsableRiskIds,
} from "@/shared/domains/medicine/exam-plan";
import { PROCEDURE_CATALOG_SOURCE } from "@/shared/domains/medicine/procedure-catalog";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";

import { getExamProposal } from "./exam-proposal-core";

const companyUuid = (id: string) => requiredUuid("Empresa inválida.").parse(id);
const planUuid = (id: string) => requiredUuid("Plano inválido.").parse(id);

export function listPlans(ctx: TenantContext, companyId: string) {
  return repo.listExamPlans(ctx, companyUuid(companyId));
}

/**
 * Detalhe do plano + se a conta da sessão pode decidir (coordenadora vinculada) + a situação da
 * proveniência frente aos riscos validados de hoje (`basis`: `current`, `outdated` ou `legacy`;
 * só leitura — a aprovação confere de novo, na transação e sob a trava da base de riscos).
 */
export async function getPlan(ctx: TenantContext, planId: string) {
  const plan = await repo.getExamPlan(ctx, planUuid(planId));
  const [canDecide, proposal] = await Promise.all([
    isActorCompanyCoordinator(ctx, plan.companyId),
    getExamProposal(ctx, plan.companyId),
  ]);
  const basis = planBasisStatus(plan.basedOn, {
    sources: proposal.basis,
    riskIds: proposalUsableRiskIds(proposal),
  });
  return { ...plan, canDecide, basis };
}

/** Rascunho a partir da proposta atual (riscos validados de fonte vigente, NOB-147). */
export async function createDraft(ctx: TenantContext, companyId: string) {
  const id = companyUuid(companyId);
  const proposal = await getExamProposal(ctx, id);
  return repo.createExamPlanDraft(ctx, id, {
    items: draftItemsFromProposal(proposal),
    basedOn: basedOnFromProposal(proposal),
    rulesVersion: proposal.rulesVersion,
    catalogVersion: PROCEDURE_CATALOG_SOURCE.version,
  });
}

export function decideItem(
  ctx: TenantContext,
  planId: string,
  itemId: string,
  input: unknown,
) {
  return repo.decideExamPlanItem(
    ctx,
    planUuid(planId),
    requiredUuid("Item inválido.").parse(itemId),
    itemDecisionSchema.parse(input),
  );
}

export function addItem(ctx: TenantContext, planId: string, input: unknown) {
  return repo.addExamPlanItem(ctx, planUuid(planId), addItemSchema.parse(input));
}

export function approve(ctx: TenantContext, planId: string, input: unknown) {
  return repo.approveExamPlan(
    ctx,
    planUuid(planId),
    approvePlanSchema.parse(input ?? {}),
  );
}
