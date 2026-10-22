import "server-only";
import { z } from "zod";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { billingOfferSchema } from "@/shared/domains/billing/contracts";
import { assertCommercialSimulation } from "./commercial-config";
import {
  createOfferVersion,
  listBillingOffers,
} from "@/shared/db/repositories/billing/offers";
import {
  registerBillingCustomer,
  listBillingCustomers,
} from "@/shared/db/repositories/billing/customers";
const pageSchema = z.coerce.number().int().min(1).max(10000);
export async function getBillingCatalog(ctx: TenantContext, page: unknown = 1) {
  assertCommercialSimulation(ctx);
  return listBillingOffers(ctx, pageSchema.parse(page));
}
export async function createBillingOffer(ctx: TenantContext, input: unknown) {
  assertCommercialSimulation(ctx);
  return createOfferVersion(ctx, billingOfferSchema.parse(input));
}
export async function createBillingCustomer(ctx: TenantContext, input: unknown) {
  assertCommercialSimulation(ctx);
  const parsed = z.object({ companyId: z.guid() }).strict().parse(input);
  return registerBillingCustomer(ctx, parsed.companyId);
}
export async function getBillingCustomers(ctx: TenantContext, page: unknown = 1) {
  assertCommercialSimulation(ctx);
  return listBillingCustomers(ctx, pageSchema.parse(page));
}
