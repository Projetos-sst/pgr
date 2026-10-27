import "server-only";
import { z } from "zod";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { assertCommercialSimulation } from "./commercial-config";
import { billingOverview } from "@/shared/db/repositories/billing/overview";
import { getCommercialInterests } from "./billing-interests-core";
import { getCommercialCharges } from "./billing-charges-core";
/** Read-only composition. Mutations use the individual validated services. */
export async function getCommercialOverview(ctx: TenantContext, page: unknown = 1) {
  assertCommercialSimulation(ctx);
  const number = z.coerce.number().int().min(1).max(10000).parse(page);
  const view = await billingOverview(ctx, number);
  const interestInbox = await getCommercialInterests(ctx);
  const invoiceList = await getCommercialCharges(ctx, { page: number });
  return { ...view, interestInbox, invoiceList };
}
