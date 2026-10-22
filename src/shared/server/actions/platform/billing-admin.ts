"use server";
import { officeAction } from "@/shared/server/office-action";
import * as core from "@/shared/server/platform/billing-admin-core";
export async function getAdminCommercialSubscriptionsAction(input: unknown) {
  return officeAction("billing.admin.list", (ctx) =>
    core.getAdminCommercialSubscriptions(ctx, input),
  );
}
export async function getAdminCommercialSubscriptionAction(id: string) {
  return officeAction("billing.admin.read", (ctx) =>
    core.getAdminCommercialSubscription(ctx, id),
  );
}
export async function reconcileAdminCommercialSubscriptionAction(input: unknown) {
  return officeAction(
    "billing.admin.reconcile",
    (ctx) => core.reconcileAdminCommercialSubscription(ctx, input),
    { audit: true },
  );
}
