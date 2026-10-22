import "server-only";
import { z } from "zod";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  billingReasonSchema,
  type BillingChangePreview,
} from "@/shared/domains/billing/contracts";
import { assertCommercialSimulation } from "./commercial-config";
import {
  previewBillingChange,
  confirmBillingChange,
  setBillingCancellation,
} from "@/shared/db/repositories/billing/subscription";
export async function previewCommercialChange(
  ctx: TenantContext,
  raw: unknown,
): Promise<BillingChangePreview> {
  assertCommercialSimulation(ctx);
  const input = z.object({ contractId: z.guid(), priceId: z.guid() }).strict().parse(raw),
    quote = await previewBillingChange(ctx, input);
  return {
    id: quote.id,
    contractId: quote.contractId,
    amountMinor: quote.amountMinor,
    items: quote.items,
    policy: quote.policy,
    effectiveAt: quote.effectiveAt.toISOString(),
    expiresAt: quote.expiresAt.toISOString(),
    simulated: true,
  };
}
export async function confirmCommercialChange(ctx: TenantContext, raw: unknown) {
  assertCommercialSimulation(ctx);
  const input = z
    .object({ quoteId: z.guid(), reason: billingReasonSchema })
    .strict()
    .parse(raw);
  return confirmBillingChange(ctx, input.quoteId, input.reason);
}
export async function cancelCommercialSubscription(ctx: TenantContext, raw: unknown) {
  assertCommercialSimulation(ctx);
  const input = z
    .object({ contractId: z.guid(), reason: billingReasonSchema })
    .strict()
    .parse(raw);
  return setBillingCancellation(ctx, input.contractId, true, input.reason);
}
export async function resumeCommercialSubscription(ctx: TenantContext, raw: unknown) {
  assertCommercialSimulation(ctx);
  const input = z
    .object({ contractId: z.guid(), reason: billingReasonSchema })
    .strict()
    .parse(raw);
  return setBillingCancellation(ctx, input.contractId, false, input.reason);
}
