import "server-only";
import { z } from "zod";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import {
  assertCommercialSimulation,
  assertCommercialOperationalAccess,
} from "./commercial-config";
import { checkoutInputSchema, startCommercialCheckout } from "./billing-checkout-core";
import * as repo from "@/shared/db/repositories/billing/orders";
export async function createCommercialOrder(ctx: TenantContext, raw: unknown) {
  assertCommercialSimulation(ctx);
  const input = checkoutInputSchema.parse(raw);
  await repo.assertOneOffOffer(ctx, input.priceId);
  return startCommercialCheckout(ctx, input);
}
export async function getCommercialOrder(ctx: TenantContext, id: unknown) {
  assertCommercialSimulation(ctx);
  return repo.getOneOffOrder(ctx, z.guid().parse(id));
}
export async function getCommercialOrders(ctx: TenantContext, page: unknown = 1) {
  assertCommercialSimulation(ctx);
  return repo.listOneOffOrders(
    ctx,
    z.coerce.number().int().min(1).max(10000).parse(page),
  );
}
export async function requirePurchasedService(ctx: TenantContext, raw: unknown) {
  assertCommercialOperationalAccess(ctx);
  const input = z
    .object({
      orderId: z.guid(),
      companyId: z.guid(),
      product: z.enum(["pgr", "medicine"]),
    })
    .strict()
    .parse(raw);
  if (!(await repo.purchasedServiceAllowed(ctx, input)))
    throw new ForbiddenError("Serviço não contratado ou pagamento ainda não confirmado.");
  return {
    financiallyAuthorized: true,
    scope: `order:${input.orderId}`,
    companyId: input.companyId,
    product: input.product,
    simulated: true,
  };
}
