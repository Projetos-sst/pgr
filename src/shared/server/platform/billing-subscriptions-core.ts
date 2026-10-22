import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { billingReasonSchema } from "@/shared/domains/billing/contracts";
import { createMockPaymentClient } from "@/shared/integrations/billing/mock-gateway";
import { BillingUnavailableError } from "@/shared/errors/billing-unavailable-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { ForbiddenError } from "@/shared/auth/errors";
import { assertCommercialSimulation, commercialEnvironment } from "./commercial-config";
import { applyBillingEvent } from "@/shared/db/repositories/billing/events";
import {
  getProviderSnapshot,
  simulateProviderEvent,
  auditReconciliation,
} from "@/shared/db/repositories/billing/provider";
import { billingOverview } from "@/shared/db/repositories/billing/overview";
export const paymentScenarioSchema = z
  .object({
    contractId: z.guid(),
    scenario: z.enum([
      "success",
      "requires_action",
      "refused",
      "renewal",
      "late",
      "recovery",
      "cancel",
      "duplicate",
      "out_of_order",
    ]),
  })
  .strict();
function paymentClient(ctx: TenantContext) {
  assertCommercialSimulation(ctx);
  if (process.env.BILLING_MOCK_FAIL_REQUESTS === "true")
    throw new BillingUnavailableError("Provedor simulado indisponível.");
  const secret = process.env.BILLING_MOCK_WEBHOOK_SECRET ?? "";
  if (secret.length < 32)
    throw new BillingUnavailableError("Provedor simulado não configurado.");
  return {
    secret,
    gateway: createMockPaymentClient({
      env: commercialEnvironment(),
      webhookSecret: secret,
    }),
  };
}
export async function getCommercialSubscriptions(ctx: TenantContext) {
  assertCommercialSimulation(ctx);
  const view = await billingOverview(ctx);
  return { simulated: true, contracts: view.contracts, customers: view.customers };
}
/** Owner-bound mock endpoint; a real unauthenticated provider webhook requires a separate reviewed adapter. */
export async function receiveCommercialWebhook(
  ctx: TenantContext,
  rawBody: string,
  signature: string,
) {
  const { gateway } = paymentClient(ctx);
  if (Buffer.byteLength(rawBody) > 16384)
    throw new ValidationError("Evento muito grande.");
  let event;
  try {
    event = await gateway.verifyAndNormalizeWebhook(rawBody, signature);
  } catch {
    throw new ForbiddenError("Evento financeiro inválido.");
  }
  return applyBillingEvent(ctx, event);
}
export async function simulateCommercialPayment(ctx: TenantContext, raw: unknown) {
  const { secret } = paymentClient(ctx),
    input = paymentScenarioSchema.parse(raw);
  const event = await simulateProviderEvent(ctx, input.contractId, input.scenario);
  const body = JSON.stringify(event),
    at = Math.floor(Date.now() / 1000);
  const signature = `t=${at},v1=${createHmac("sha256", secret).update(`${at}.${body}`).digest("hex")}`;
  return receiveCommercialWebhook(ctx, body, signature);
}
export async function reconcileCommercialSubscription(ctx: TenantContext, raw: unknown) {
  paymentClient(ctx);
  const input = z
    .object({ contractId: z.guid(), reason: billingReasonSchema })
    .strict()
    .parse(raw);
  await auditReconciliation(ctx, input.contractId, input.reason);
  const event = await getProviderSnapshot(ctx, input.contractId);
  if (!event)
    return {
      applied: false,
      duplicate: false,
      message: "Provedor simulado ainda sem confirmação.",
    };
  return applyBillingEvent(ctx, event);
}
