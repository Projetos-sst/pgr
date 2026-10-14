import "server-only";

import { eq } from "drizzle-orm";

import { logTenantEvent } from "@/shared/tenant/audit-log";

import { withOrg } from "../with-org";
import { tenantProbe, type TenantProbe } from "../schema/tenant-probe";

export async function listTenantProbes(orgId: string): Promise<TenantProbe[]> {
  return withOrg(orgId, (tx) =>
    tx.select().from(tenantProbe).where(eq(tenantProbe.organizationId, orgId)),
  );
}

export type InsertTenantProbeResult =
  | { ok: true; probe: TenantProbe }
  | { ok: false; error: "CROSS_TENANT_REJECTED" };

export async function insertTenantProbe(
  orgId: string,
  input: { organizationId: string; label?: string | null },
): Promise<InsertTenantProbeResult> {
  try {
    const [probe] = await withOrg(orgId, (tx) =>
      tx
        .insert(tenantProbe)
        .values({ organizationId: input.organizationId, label: input.label ?? null })
        .returning(),
    );
    return { ok: true, probe };
  } catch {
    logTenantEvent("error", {
      operation: "tenant.cross_tenant_rejected",
      outcome: "rejected",
      orgId,
    });
    return { ok: false, error: "CROSS_TENANT_REJECTED" };
  }
}
