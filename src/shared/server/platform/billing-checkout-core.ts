import "server-only";
import { z } from "zod";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { idempotencyKeySchema } from "@/shared/domains/billing/contracts";
import { BillingUnavailableError } from "@/shared/errors/billing-unavailable-error";
import { createMockPaymentClient } from "@/shared/integrations/billing/mock-gateway";
import {
  createCheckout,
  bindMockCustomer,
} from "@/shared/db/repositories/billing/checkout";
import { assertCommercialSimulation, commercialEnvironment } from "./commercial-config";
export const checkoutInputSchema = z
  .object({ companyId: z.guid(), priceId: z.guid(), key: idempotencyKeySchema })
  .strict();
export async function startCommercialCheckout(ctx: TenantContext, raw: unknown) {
  assertCommercialSimulation(ctx);
  const input = checkoutInputSchema.parse(raw);
  if (process.env.BILLING_MOCK_FAIL_REQUESTS === "true")
    throw new BillingUnavailableError(
      "Provedor simulado indisponível. Repita a solicitação com a mesma chave.",
    );
  const secret = process.env.BILLING_MOCK_WEBHOOK_SECRET ?? "";
  if (secret.length < 32)
    throw new BillingUnavailableError("O provedor simulado ainda não foi configurado.");
  const gateway = createMockPaymentClient({
    env: commercialEnvironment(),
    webhookSecret: secret,
  });
  const result = await createCheckout(ctx, input);
  const customer = await gateway.ensureCustomer({
    tenantId: ctx.tenantId,
    customerId: result.customerId,
  });
  await bindMockCustomer(ctx, result.customerId, customer.providerCustomerId);
  // The repository owns customer identity; retries reuse it, rather than creating another Customer.
  const session = await gateway.createCheckoutSession({
    sessionId: result.sessionId,
    contractId: result.contractId,
    customerId: customer.providerCustomerId,
    items: result.snapshot.items,
    interval: result.snapshot.interval,
    expiresAt: result.expiresAt,
  });
  return { simulated: true, ...session, contractId: result.contractId };
}
