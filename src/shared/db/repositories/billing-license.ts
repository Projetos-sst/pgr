import "server-only";
import { sql } from "drizzle-orm";
import type { Plan } from "@/shared/tenant/active-tenant";
import { commercialSimulationOn } from "./billing-export";
/** Additive sandbox overlay: never changes orgs.plan or revokes legacy Pro. */
export async function resolveCommercialPlan(
  orgId: string,
  original: Plan,
): Promise<Plan> {
  if (original === "pro" || !commercialSimulationOn()) return original;
  const { withOrg } = await import("../with-org");
  const rows = await withOrg(orgId, (tx) =>
    tx.execute<{ allowed: boolean }>(
      sql`select public.billing_tenant_pro_allowed(${orgId}) as allowed`,
    ),
  );
  return rows[0]?.allowed === true ? "pro" : original;
}
