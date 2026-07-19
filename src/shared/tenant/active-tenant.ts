import "server-only";

import {
  listTenantMembershipsByUser,
  type TenantMembershipRow,
} from "@/shared/db/repositories/org-memberships";

import { provisionPersonalTenant } from "./provision-personal-tenant";
import { toDomainRole } from "./roles";

export { toDomainRole } from "./roles";

export type Plan = "free" | "pro";

export type ActiveTenant = {
  tenantId: string;
  name: string | null;
  plan: Plan;
  role: string;
  membershipCount: number;
};

export function isSwitcherEligible(membershipCount: number): boolean {
  return membershipCount >= 2;
}

export function selectActiveTenant(
  memberships: TenantMembershipRow[],
  cookieTenantId: string | null,
): ActiveTenant | null {
  if (memberships.length === 0) return null;
  if (memberships.length === 1) return toActiveTenant(memberships[0], 1);

  const byCookie = cookieTenantId
    ? memberships.find((membership) => membership.orgId === cookieTenantId)
    : undefined;
  const chosen = byCookie ?? selectDefaultTenant(memberships);

  return toActiveTenant(chosen, memberships.length);
}

/**
 * Sem seleção válida no cookie, o padrão é a org pessoal (owner, sem Clerk) —
 * a "casa" do usuário; ele troca pelo seletor. Fallback determinístico (menor
 * orgId) quando não há org pessoal (ex.: só colaborações).
 */
function selectDefaultTenant(memberships: TenantMembershipRow[]): TenantMembershipRow {
  const personal = memberships.find(
    (membership) => membership.role === "owner" && membership.clerkOrgId === null,
  );
  if (personal) return personal;
  return [...memberships].sort((a, b) => a.orgId.localeCompare(b.orgId))[0];
}

function toActiveTenant(
  membership: TenantMembershipRow,
  membershipCount: number,
): ActiveTenant {
  return {
    tenantId: membership.orgId,
    name: membership.name,
    plan: normalizePlan(membership.plan),
    role: toDomainRole(membership.role),
    membershipCount,
  };
}

export async function resolveActiveTenant(
  userId: string,
  cookieTenantId: string | null = null,
): Promise<ActiveTenant | null> {
  let memberships = await listTenantMembershipsByUser(userId);

  if (memberships.length === 0) {
    await provisionPersonalTenant({ userId });
    memberships = await listTenantMembershipsByUser(userId);
  }

  return selectActiveTenant(memberships, cookieTenantId);
}

function normalizePlan(plan: string): Plan {
  return plan === "pro" ? "pro" : "free";
}
