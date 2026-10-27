"use server";
import { officeAction } from "@/shared/server/office-action";
import { startCommercialCheckout } from "@/shared/server/platform/billing-checkout-core";
import { getCommercialCheckoutSession } from "@/shared/server/platform/billing-checkout-session-core";
export async function getCommercialCheckoutSessionAction(id: string) {
  return officeAction("billing.checkout.read", (ctx) =>
    getCommercialCheckoutSession(ctx, id),
  );
}
export async function startCommercialCheckoutAction(input: unknown) {
  return officeAction(
    "billing.checkout.start",
    (ctx) => startCommercialCheckout(ctx, input),
    { audit: true },
  );
}
