import "server-only";

import {
  listTenantMembershipsByUser,
  type TenantMembershipRow,
} from "@/shared/db/repositories/org-memberships";

import { provisionPersonalTenant } from "./provision-personal-tenant";

export type Plan = "free" | "pro";

export type ActiveTenant = {
  tenantId: string;
  plan: Plan;
  role: string;
  membershipCount: number;
};

export function isSwitcherEligible(membershipCount: number): boolean {
  return membershipCount >= 2;
}

const DOMAIN_ROLES = new Set(["owner", "collaborator", "client"]);

const CLERK_ROLE_TO_DOMAIN: Record<string, string> = {
  "org:admin": "owner",
  "org:member": "collaborator",
  "org:client": "client",
};

/**
 * Papéis do Clerk (`org:admin`/`org:member`) chegam crus pelo webhook; o tenant
 * pessoal grava `owner` direto. Normaliza para o vocabulário de domínio
 * (`owner`/`collaborator`/`client`) num único ponto de leitura — papel
 * desconhecido cai em `client` (menor privilégio).
 */
export function toDomainRole(role: string): string {
  if (DOMAIN_ROLES.has(role)) return role;
  return CLERK_ROLE_TO_DOMAIN[role] ?? "client";
}

export function selectActiveTenant(
  memberships: TenantMembershipRow[],
  cookieTenantId: string | null,
): ActiveTenant | null {
  if (memberships.length === 0) return null;

  const chosen =
    memberships.length === 1
      ? memberships[0]
      : (memberships.find((membership) => membership.orgId === cookieTenantId) ?? null);

  if (!chosen) return null;

  return {
    tenantId: chosen.orgId,
    plan: normalizePlan(chosen.plan),
    role: toDomainRole(chosen.role),
    membershipCount: memberships.length,
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
