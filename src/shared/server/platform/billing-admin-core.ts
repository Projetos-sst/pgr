import "server-only";
import { z } from "zod";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import { billingAdminFilterSchema } from "@/shared/domains/billing/admin";
import { assertCommercialSimulation } from "./commercial-config";
import * as repo from "@/shared/db/repositories/billing/admin";
import { reconcileCommercialSubscription } from "./billing-subscriptions-core";
export function assertBillingAdministrator(ctx: TenantContext) {
  assertCommercialSimulation(ctx);
  if (
    !(process.env.BILLING_ADMIN_USER_IDS ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .includes(ctx.userId)
  )
    throw new ForbiddenError("Permissão administrativa comercial não concedida.");
}
export async function getAdminCommercialSubscriptions(
  ctx: TenantContext,
  raw: unknown = {},
) {
  assertBillingAdministrator(ctx);
  return repo.listAdminSubscriptions(ctx, billingAdminFilterSchema.parse(raw));
}
export async function getAdminCommercialSubscription(ctx: TenantContext, id: unknown) {
  assertBillingAdministrator(ctx);
  return repo.getAdminSubscription(ctx, z.guid().parse(id));
}
export async function reconcileAdminCommercialSubscription(
  ctx: TenantContext,
  raw: unknown,
) {
  assertBillingAdministrator(ctx);
  return reconcileCommercialSubscription(ctx, raw);
}
