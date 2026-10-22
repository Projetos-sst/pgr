"use server";
import { officeAction } from "@/shared/server/office-action";
import {
  getCommercialTrial,
  startCommercialTrial,
} from "@/shared/server/platform/billing-trials-core";
export async function getCommercialTrialAction(companyId: string) {
  return officeAction("billing.trial.read", (ctx) => getCommercialTrial(ctx, companyId));
}
export async function startCommercialTrialAction(input: unknown) {
  return officeAction("billing.trial.start", (ctx) => startCommercialTrial(ctx, input), {
    audit: true,
  });
}
