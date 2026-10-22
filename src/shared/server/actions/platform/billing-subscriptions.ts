"use server";
import { officeAction } from "@/shared/server/office-action";
import * as core from "@/shared/server/platform/billing-subscriptions-core";
export async function getCommercialSubscriptionsAction() {
  return officeAction("billing.subscription.read", (ctx) =>
    core.getCommercialSubscriptions(ctx),
  );
}
export async function simulateCommercialPaymentAction(input: unknown) {
  return officeAction(
    "billing.payment.simulate",
    (ctx) => core.simulateCommercialPayment(ctx, input),
    { audit: true },
  );
}
export async function reconcileCommercialSubscriptionAction(input: unknown) {
  return officeAction(
    "billing.subscription.reconcile",
    (ctx) => core.reconcileCommercialSubscription(ctx, input),
    { audit: true },
  );
}
