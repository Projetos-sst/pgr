"use server";
import { officeAction } from "@/shared/server/office-action";
import { getPgrReadiness } from "@/shared/server/pgr/pgr-readiness-core";
export async function getPgrReadinessAction(pgrId: string) {
  return officeAction("pgr.readiness", (ctx) => getPgrReadiness(ctx.tenantId, pgrId));
}
