import "server-only";

import { createTenant } from "@/shared/db/repositories/orgs";
import {
  ensureOwnerMembership,
  listTenantMembershipsByUser,
} from "@/shared/db/repositories/org-memberships";
import { upsertUser } from "@/shared/db/repositories/users";

import { logTenantEvent } from "./audit-log";

export type ProvisionInput = { userId: string; name?: string | null };
export type ProvisionResult = { tenantId: string; created: boolean };

export async function provisionPersonalTenant(
  input: ProvisionInput,
): Promise<ProvisionResult> {
  const existingTenantId = await findPersonalOwnerTenant(input.userId);
  if (existingTenantId) {
    return { tenantId: existingTenantId, created: false };
  }

  await upsertUser({ id: input.userId });

  const tenant = await createTenant({ name: input.name ?? null });
  await ensureOwnerMembership({ orgId: tenant.id, userId: input.userId });

  logTenantEvent("info", {
    operation: "tenant.provisioned",
    outcome: "ok",
    orgId: tenant.id,
    userId: input.userId,
  });

  return { tenantId: tenant.id, created: true };
}

async function findPersonalOwnerTenant(userId: string): Promise<string | null> {
  const memberships = await listTenantMembershipsByUser(userId);
  const personal = memberships.find(
    (membership) => membership.role === "owner" && membership.clerkOrgId === null,
  );
  return personal ? personal.orgId : null;
}
