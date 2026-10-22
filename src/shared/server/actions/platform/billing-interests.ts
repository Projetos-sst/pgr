"use server";
import { officeAction } from "@/shared/server/office-action";
import * as core from "@/shared/server/platform/billing-interests-core";
export async function registerCommercialInterestAction(input: unknown) {
  return officeAction(
    "billing.interest.register",
    (ctx) => core.registerCommercialInterest(ctx, input),
    { audit: true },
  );
}
export async function getCommercialInterestsAction(input: unknown = {}) {
  return officeAction("billing.interests.read", (ctx) =>
    core.getCommercialInterests(ctx, input),
  );
}
export async function acknowledgeCommercialInterestAction(input: unknown) {
  return officeAction(
    "billing.interest.acknowledge",
    (ctx) => core.acknowledgeCommercialInterest(ctx, input),
    { audit: true },
  );
}
