import "server-only";
import { z } from "zod";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { billingReasonSchema } from "@/shared/domains/billing/contracts";
import { assertCommercialSimulation } from "./commercial-config";
import * as repo from "@/shared/db/repositories/billing/interests";
export async function registerCommercialInterest(ctx: TenantContext, raw: unknown) {
  assertCommercialSimulation(ctx);
  const input = z
    .object({
      trialId: z.guid(),
      interest: z.enum(["pro", "pgr", "medicine", "both"]),
      message: z.string().trim().max(2000).default(""),
    })
    .strict()
    .parse(raw);
  return repo.registerBillingInterest(ctx, input);
}
export async function getCommercialInterests(ctx: TenantContext, raw: unknown = {}) {
  assertCommercialSimulation(ctx);
  const input = z
    .object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      status: z.enum(["pending", "acknowledged"]).optional(),
      companyId: z.guid().optional(),
    })
    .strict()
    .parse(raw);
  return repo.listBillingInterests(ctx, input);
}
export async function acknowledgeCommercialInterest(ctx: TenantContext, raw: unknown) {
  assertCommercialSimulation(ctx);
  const input = z
    .object({ id: z.guid(), reason: billingReasonSchema })
    .strict()
    .parse(raw);
  return repo.acknowledgeBillingInterest(ctx, input.id, input.reason);
}
