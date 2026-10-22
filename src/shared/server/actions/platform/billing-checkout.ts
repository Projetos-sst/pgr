"use server";
import { officeAction } from "@/shared/server/office-action";
import { startCommercialCheckout } from "@/shared/server/platform/billing-checkout-core";
export async function startCommercialCheckoutAction(input: unknown) {
  return officeAction(
    "billing.checkout.start",
    (ctx) => startCommercialCheckout(ctx, input),
    { audit: true },
  );
}
