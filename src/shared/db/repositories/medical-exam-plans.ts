import "server-only";

import { and, asc, desc, eq, max, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import {
  ADDED_ITEM_JUSTIFICATION_MESSAGE,
  type AddItemValues,
  type ApprovePlanValues,
  type DraftItem,
  type ItemDecisionValues,
} from "@/shared/domains/medicine/exam-plan";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

import { withOrg, type TenantTransaction } from "../with-org";
import { companies } from "../schema/companies";
import {
  medicalExamPlanEvents as events,
  medicalExamPlanItems as items,
  medicalExamPlans as plans,
  type MedicalExamPlan,
  type MedicalExamPlanEvent,
  type MedicalExamPlanItem,
} from "../schema/medical-exam-plans";
import { assertCompanyModuleTx } from "./company-modules";
import { auditedTenantWrite } from "./audited-write";
import { assertActorIsCompanyCoordinator } from "./medico-user-links";

export type ExamPlanDetail = MedicalExamPlan & {
  items: MedicalExamPlanItem[];
  events: MedicalExamPlanEvent[];
};

async function actorTx<T>(ctx: TenantContext, fn: (tx: TenantTransaction) => Promise<T>) {
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor', ${ctx.userId}, true)`);
    return fn(tx);
  });
}

async function assertCompany(tx: TenantTransaction, orgId: string, companyId: string) {
  const [company] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
    .limit(1);
  if (!company) throw new NotFoundError();
  await assertCompanyModuleTx(tx, orgId, companyId, "medicine");
}

async function planTx(tx: TenantTransaction, orgId: string, planId: string) {
  const [plan] = await tx
    .select()
    .from(plans)
    .where(and(eq(plans.orgId, orgId), eq(plans.id, planId)))
    .limit(1);
  if (!plan) throw new NotFoundError();
  await assertCompanyModuleTx(tx, orgId, plan.companyId, "medicine");
  return plan;
}

function assertDraft(plan: MedicalExamPlan) {
  if (plan.status !== "draft")
    throw new ValidationError(
      "Plano aprovado ou substituído não muda. Prepare uma nova versão a partir da proposta.",
    );
}

async function logEvent(
  tx: TenantTransaction,
  ctx: TenantContext,
  plan: MedicalExamPlan,
  event: string,
  details: Record<string, unknown> = {},
) {
  await tx.insert(events).values({
    orgId: ctx.tenantId,
    companyId: plan.companyId,
    planId: plan.id,
    actor: ctx.userId,
    event,
    details,
  });
}

export async function listExamPlans(
  ctx: TenantContext,
  companyId: string,
): Promise<MedicalExamPlan[]> {
  return actorTx(ctx, async (tx) => {
    await assertCompany(tx, ctx.tenantId, companyId);
    return tx
      .select()
      .from(plans)
      .where(and(eq(plans.orgId, ctx.tenantId), eq(plans.companyId, companyId)))
      .orderBy(desc(plans.version));
  });
}

export async function getExamPlan(
  ctx: TenantContext,
  planId: string,
): Promise<ExamPlanDetail> {
  return actorTx(ctx, async (tx) => {
    const plan = await planTx(tx, ctx.tenantId, planId);
    const [planItems, planEvents] = await Promise.all([
      tx
        .select()
        .from(items)
        .where(and(eq(items.orgId, ctx.tenantId), eq(items.planId, planId)))
        .orderBy(asc(items.exposureGroup), asc(items.jobRole), asc(items.procedureCode)),
      tx
        .select()
        .from(events)
        .where(and(eq(events.orgId, ctx.tenantId), eq(events.planId, planId)))
        .orderBy(desc(events.createdAt), desc(events.id)),
    ]);
    return { ...plan, items: planItems, events: planEvents };
  });
}

/** Rascunho preparado pela equipe a partir da proposta; um rascunho aberto por empresa. */
export async function createExamPlanDraft(
  ctx: TenantContext,
  companyId: string,
  draft: {
    items: DraftItem[];
    basedOn: Record<string, unknown>;
    rulesVersion: string;
    catalogVersion: string;
  },
): Promise<MedicalExamPlan> {
  return auditedTenantWrite(ctx.tenantId, "medicine.exam_plans.draft_rejected", () =>
    actorTx(ctx, async (tx) => {
      await assertCompany(tx, ctx.tenantId, companyId);
      const [{ last }] = await tx
        .select({ last: max(plans.version) })
        .from(plans)
        .where(and(eq(plans.orgId, ctx.tenantId), eq(plans.companyId, companyId)));
      const [plan] = await tx
        .insert(plans)
        .values({
          orgId: ctx.tenantId,
          companyId,
          version: (last ?? 0) + 1,
          basedOn: draft.basedOn,
          rulesVersion: draft.rulesVersion,
          catalogVersion: draft.catalogVersion,
          preparedBy: ctx.userId,
        })
        .returning();
      if (draft.items.length)
        await tx.insert(items).values(
          draft.items.map((item) => ({
            orgId: ctx.tenantId,
            companyId,
            planId: plan.id,
            exposureGroup: item.exposureGroup,
            jobRole: item.jobRole,
            procedureCode: item.procedureCode,
            otherDescription: item.otherDescription,
            origin: "suggested" as const,
            ruleId: item.ruleId,
            periodicity: item.periodicity,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          })),
        );
      await logEvent(tx, ctx, plan, "draft_created", { items: draft.items.length });
      return plan;
    }),
  );
}

export async function decideExamPlanItem(
  ctx: TenantContext,
  planId: string,
  itemId: string,
  input: ItemDecisionValues,
): Promise<MedicalExamPlanItem> {
  return auditedTenantWrite(ctx.tenantId, "medicine.exam_plans.decision_rejected", () =>
    actorTx(ctx, async (tx) => {
      const plan = await planTx(tx, ctx.tenantId, planId);
      assertDraft(plan);
      await assertActorIsCompanyCoordinator(tx, ctx, plan.companyId);
      const [current] = await tx
        .select()
        .from(items)
        .where(
          and(
            eq(items.orgId, ctx.tenantId),
            eq(items.planId, planId),
            eq(items.id, itemId),
          ),
        )
        .limit(1);
      if (!current) throw new NotFoundError();
      // Mesma regra do CHECK `ck_exam_plan_items_justification` (MED-15), conferida antes para a
      // tela dizer o motivo em vez de "Valor fora do permitido." (NOB-112).
      if (current.origin === "added" && !input.justification)
        throw new ValidationError(ADDED_ITEM_JUSTIFICATION_MESSAGE);
      const [updated] = await tx
        .update(items)
        .set({
          decision: input.decision,
          periodicity: input.periodicity,
          justification: input.justification ?? null,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(and(eq(items.orgId, ctx.tenantId), eq(items.id, itemId)))
        .returning();
      if (!updated) throw new ForbiddenError();
      await logEvent(tx, ctx, plan, "item_decided", {
        itemId,
        procedureCode: current.procedureCode,
        from: { decision: current.decision, periodicity: current.periodicity },
        to: { decision: input.decision, periodicity: input.periodicity },
        justification: input.justification ?? null,
      });
      return updated;
    }),
  );
}

export async function addExamPlanItem(
  ctx: TenantContext,
  planId: string,
  input: AddItemValues,
): Promise<MedicalExamPlanItem> {
  return auditedTenantWrite(ctx.tenantId, "medicine.exam_plans.add_rejected", () =>
    actorTx(ctx, async (tx) => {
      const plan = await planTx(tx, ctx.tenantId, planId);
      assertDraft(plan);
      await assertActorIsCompanyCoordinator(tx, ctx, plan.companyId);
      const [created] = await tx
        .insert(items)
        .values({
          orgId: ctx.tenantId,
          companyId: plan.companyId,
          planId,
          exposureGroup: input.exposureGroup,
          jobRole: input.jobRole,
          procedureCode: input.code,
          otherDescription:
            input.code === "9999" ? (input.otherDescription ?? null) : null,
          origin: "added",
          periodicity: input.periodicity,
          justification: input.justification,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })
        .returning();
      await logEvent(tx, ctx, plan, "item_added", {
        itemId: created.id,
        procedureCode: input.code,
        exposureGroup: input.exposureGroup,
        justification: input.justification,
      });
      return created;
    }),
  );
}

/** Aprovação pela coordenadora vinculada; o aprovado anterior vira "superseded" na mesma transação. */
export async function approveExamPlan(
  ctx: TenantContext,
  planId: string,
  input: ApprovePlanValues,
): Promise<MedicalExamPlan> {
  return auditedTenantWrite(ctx.tenantId, "medicine.exam_plans.approval_rejected", () =>
    actorTx(ctx, async (tx) => {
      const plan = await planTx(tx, ctx.tenantId, planId);
      assertDraft(plan);
      const { medicoId } = await assertActorIsCompanyCoordinator(tx, ctx, plan.companyId);
      const superseded = await tx
        .update(plans)
        .set({ status: "superseded", updatedAt: new Date() })
        .where(
          and(
            eq(plans.orgId, ctx.tenantId),
            eq(plans.companyId, plan.companyId),
            eq(plans.status, "approved"),
          ),
        )
        .returning({ id: plans.id, version: plans.version });
      const [approved] = await tx
        .update(plans)
        .set({
          status: "approved",
          approvedByUser: ctx.userId,
          approvedByMedicoId: medicoId,
          approvedAt: new Date(),
          approvalNote: input.note || null,
          updatedAt: new Date(),
        })
        .where(and(eq(plans.orgId, ctx.tenantId), eq(plans.id, planId)))
        .returning();
      if (!approved) throw new ForbiddenError();
      for (const previous of superseded)
        await logEvent(tx, ctx, { ...plan, id: previous.id }, "superseded", {
          byPlanId: plan.id,
          byVersion: plan.version,
        });
      await logEvent(tx, ctx, approved, "approved", {
        medicoId,
        note: input.note || null,
        supersededVersions: superseded.map((p) => p.version),
      });
      return approved;
    }),
  );
}
