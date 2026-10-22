import "server-only";
import { z } from "zod";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { assertCommercialSimulation } from "./commercial-config";
import {
  startBillingTrial,
  getBillingTrial,
} from "@/shared/db/repositories/billing/trials";
import { companyBillingExportAllowed } from "@/shared/db/repositories/billing-export";
export async function startCommercialTrial(ctx: TenantContext, raw: unknown) {
  assertCommercialSimulation(ctx);
  const input = z.object({ companyId: z.guid() }).strict().parse(raw);
  return startBillingTrial(ctx, input.companyId);
}
export async function getCommercialTrial(ctx: TenantContext, companyId: unknown) {
  assertCommercialSimulation(ctx);
  const id = z.guid().parse(companyId),
    trial = await getBillingTrial(ctx, id);
  if (!trial) return { trial: null, status: "not_started" as const, simulated: true };
  const [pgr, medicine] = await Promise.all([
    companyBillingExportAllowed(ctx.tenantId, id, "pgr"),
    companyBillingExportAllowed(ctx.tenantId, id, "medicine"),
  ]);
  return {
    trial,
    status: trial.endsAt > new Date() ? ("active" as const) : ("expired" as const),
    hasConfirmedPurchase: trial.convertedAt !== null,
    exportAllowed: { pgr, medicine },
    simulated: true,
  };
}
