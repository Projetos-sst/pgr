import "server-only";
import { z } from "zod";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { idempotencyKeySchema } from "@/shared/domains/billing/contracts";
import { BillingUnavailableError } from "@/shared/errors/billing-unavailable-error";
import { createMockPaymentClient } from "@/shared/integrations/billing/mock-gateway";
import { assertCommercialSimulation, commercialEnvironment } from "./commercial-config";
import * as repo from "@/shared/db/repositories/billing/portal";
export const portalInputSchema = z
  .object({ customerId: z.guid(), key: idempotencyKeySchema })
  .strict();
export async function openCommercialPortal(ctx: TenantContext, raw: unknown) {
  assertCommercialSimulation(ctx);
  const input = portalInputSchema.parse(raw),
    secret = process.env.BILLING_MOCK_WEBHOOK_SECRET ?? "";
  if (process.env.BILLING_MOCK_FAIL_REQUESTS === "true" || secret.length < 32)
    throw new BillingUnavailableError("Portal simulado indisponível neste momento.");
  const gateway = createMockPaymentClient({
      env: commercialEnvironment(),
      webhookSecret: secret,
    }),
    session = await repo.createBillingPortal(ctx, input);
  return { ...(await gateway.createPortalSession(session)), simulated: true };
}
export async function validateCommercialPortal(ctx: TenantContext, id: unknown) {
  assertCommercialSimulation(ctx);
  return repo.validateBillingPortal(ctx, z.guid().parse(id));
}
export async function getCommercialPaymentProfile(
  ctx: TenantContext,
  customerId: unknown,
) {
  assertCommercialSimulation(ctx);
  return repo.getBillingPaymentProfile(ctx, z.guid().parse(customerId));
}
export async function synchronizeMockPaymentProfile(ctx: TenantContext, raw: unknown) {
  assertCommercialSimulation(ctx);
  const input = z
    .object({ sessionId: z.guid(), method: z.literal("visa_test_4242") })
    .strict()
    .parse(raw);
  if (process.env.BILLING_MOCK_FAIL_REQUESTS === "true")
    throw new BillingUnavailableError("Portal simulado indisponível.");
  return repo.updateMockPaymentProfile(ctx, input.sessionId);
}
