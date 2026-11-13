import "server-only";

import { createHash } from "node:crypto";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { todayInSaoPaulo } from "@/shared/dates";
import * as checkoutRepo from "@/shared/db/repositories/billing-checkout";
import { checkoutInputSchema, checkoutLines } from "@/shared/domains/commercial/checkout";
import { contractTargets } from "@/shared/domains/commercial/entitlement";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { ValidationError } from "@/shared/errors/validation-error";
import { createCommercialCheckoutSession } from "@/shared/integrations/stripe/client";
import { getAppBaseUrl } from "@/shared/integrations/stripe/config";

import { requireFinancialOwner } from "./commercial-core";

const contractIdSchema = requiredUuid("Contratação inválida.");

export function checkoutIdFor(orgId: string, idempotencyKey: string): string {
  const hex = createHash("sha256")
    .update(`commercial-checkout:${orgId}:${idempotencyKey}`)
    .digest("hex");
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

export async function startContractCheckout(
  ctx: TenantContext,
  contractId: string,
  input: unknown,
): Promise<checkoutRepo.CheckoutSession> {
  const env = requireFinancialOwner(ctx);
  const id = contractIdSchema.parse(contractId);
  const { idempotencyKey } = checkoutInputSchema.parse(input);
  const prepared = await checkoutRepo.prepareCheckout(ctx, id, idempotencyKey);
  if (prepared.kind === "existing") return prepared.session;
  const charge = checkoutLines(prepared.contract, prepared.prices, {
    today: todayInSaoPaulo(),
    env,
  });
  if ("problem" in charge) throw new ValidationError(charge.problem);
  const checkoutId = checkoutIdFor(ctx.tenantId, idempotencyKey);
  const base = getAppBaseUrl();
  const session = await createCommercialCheckoutSession({
    checkoutId,
    lines: charge.lines,
    providerCustomerId: prepared.payer.providerCustomerId,
    customerEmail: prepared.payer.billingEmail,
    successUrl: `${base}/plans?commercial_checkout=success`,
    cancelUrl: `${base}/plans?commercial_checkout=cancelled`,
  });
  return checkoutRepo.recordCheckout(ctx, {
    id: checkoutId,
    contractId: id,
    customerId: prepared.contract.customerId,
    targets: contractTargets(prepared.contract),
    idempotencyKey,
    providerSessionId: session.id,
    url: session.url,
    expiresAt: session.expiresAt,
  });
}
