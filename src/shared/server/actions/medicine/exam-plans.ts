"use server";
import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import {
  addItem,
  approve,
  createDraft,
  decideItem,
  getPlan,
  listPlans,
} from "@/shared/server/medicine/exam-plan-core";

export async function listExamPlansAction(companyId: string) {
  return officeAction("medicine.exam_plans.list", (ctx) => listPlans(ctx, companyId));
}

export async function getExamPlanAction(planId: string) {
  return officeAction("medicine.exam_plans.get", (ctx) => getPlan(ctx, planId));
}

export async function createExamPlanDraftAction(companyId: string) {
  return officeAction(
    "medicine.exam_plans.draft",
    async (ctx) => {
      const plan = await createDraft(ctx, companyId);
      revalidatePath(`/companies/${companyId}/exam-plan`);
      return plan;
    },
    { audit: true },
  );
}

export async function decideExamPlanItemAction(
  planId: string,
  itemId: string,
  input: unknown,
) {
  return officeAction(
    "medicine.exam_plans.decide",
    async (ctx) => {
      const item = await decideItem(ctx, planId, itemId, input);
      revalidatePath(`/companies/${item.companyId}/exam-plan`);
      return item;
    },
    { audit: true },
  );
}

export async function addExamPlanItemAction(planId: string, input: unknown) {
  return officeAction(
    "medicine.exam_plans.add",
    async (ctx) => {
      const item = await addItem(ctx, planId, input);
      revalidatePath(`/companies/${item.companyId}/exam-plan`);
      return item;
    },
    { audit: true },
  );
}

export async function approveExamPlanAction(planId: string, input: unknown) {
  return officeAction(
    "medicine.exam_plans.approve",
    async (ctx) => {
      const plan = await approve(ctx, planId, input);
      revalidatePath(`/companies/${plan.companyId}/exam-plan`);
      return plan;
    },
    { audit: true },
  );
}
