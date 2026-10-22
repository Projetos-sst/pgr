"use server";
import { officeAction } from "@/shared/server/office-action";
import * as core from "@/shared/server/platform/billing-management-core";
export async function previewCommercialChangeAction(input: unknown) {
  return officeAction(
    "billing.change.preview",
    (ctx) => core.previewCommercialChange(ctx, input),
    { audit: true },
  );
}
export async function confirmCommercialChangeAction(input: unknown) {
  return officeAction(
    "billing.change.confirm",
    (ctx) => core.confirmCommercialChange(ctx, input),
    { audit: true },
  );
}
export async function cancelCommercialSubscriptionAction(input: unknown) {
  return officeAction(
    "billing.subscription.cancel",
    (ctx) => core.cancelCommercialSubscription(ctx, input),
    { audit: true },
  );
}
export async function resumeCommercialSubscriptionAction(input: unknown) {
  return officeAction(
    "billing.subscription.resume",
    (ctx) => core.resumeCommercialSubscription(ctx, input),
    { audit: true },
  );
}
