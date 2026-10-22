import "server-only";
import { z } from "zod";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { assertCommercialSimulation } from "./commercial-config";
import { readCheckoutSession } from "@/shared/db/repositories/billing/checkout-session";
export async function getCommercialCheckoutSession(ctx: TenantContext, id: unknown) {
  assertCommercialSimulation(ctx);
  return readCheckoutSession(ctx, z.guid().parse(id));
}
