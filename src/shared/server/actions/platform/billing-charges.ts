"use server";
import { officeAction } from "@/shared/server/office-action";
import { getCommercialCharges } from "@/shared/server/platform/billing-charges-core";
export async function getCommercialChargesAction(input: unknown = {}) {
  return officeAction("billing.charges.read", (ctx) => getCommercialCharges(ctx, input));
}
