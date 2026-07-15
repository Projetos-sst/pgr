"use server";

import { officeAction } from "@/shared/server/office-action";
import { startProCheckout } from "@/shared/server/platform/billing-core";
import type { ActionResult } from "@/shared/server/result";

export async function startProCheckoutAction(): Promise<ActionResult<{ url: string }>> {
  return officeAction("platform.billing.checkout", (ctx) => startProCheckout(ctx), {
    audit: true,
  });
}
