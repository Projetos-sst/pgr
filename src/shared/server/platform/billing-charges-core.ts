import "server-only";
import { z } from "zod";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { assertCommercialSimulation } from "./commercial-config";
import { listCommercialCharges } from "@/shared/db/repositories/billing/charges";
export async function getCommercialCharges(ctx: TenantContext, raw: unknown = {}) {
  assertCommercialSimulation(ctx);
  const input = z
    .object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      companyId: z.guid().optional(),
    })
    .strict()
    .parse(raw);
  return listCommercialCharges(ctx, input.page, input.companyId);
}
