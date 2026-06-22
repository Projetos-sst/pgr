import "server-only";

import { requireTenantContext } from "@/shared/auth/require-tenant-context";
import { NoTenantContextError, UnauthorizedError } from "@/shared/auth/errors";
import {
  listTenantMembershipsByUser,
  type TenantMembershipRow,
} from "@/shared/db/repositories/org-memberships";

import { isSwitcherEligible, toDomainRole, type Plan } from "./active-tenant";

export type TenantOption = {
  orgId: string;
  name: string;
  roleLabel: string;
  plan: Plan;
  isActive: boolean;
};

export type TenantSwitcherData = {
  activeOrgId: string;
  options: TenantOption[];
  canSwitch: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  owner: "você",
  collaborator: "colaborador",
  client: "cliente",
};

function displayName(membership: TenantMembershipRow): string {
  const name = membership.name?.trim();
  if (name) return name;
  return membership.clerkOrgId ? "Organização" : "Minha organização";
}

export function toTenantOptions(
  memberships: TenantMembershipRow[],
  activeOrgId: string,
): TenantOption[] {
  return memberships
    .map((membership) => ({
      orgId: membership.orgId,
      name: displayName(membership),
      roleLabel: ROLE_LABEL[toDomainRole(membership.role)] ?? "membro",
      plan: (membership.plan === "pro" ? "pro" : "free") as Plan,
      isActive: membership.orgId === activeOrgId,
    }))
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export async function getTenantSwitcher(): Promise<TenantSwitcherData | null> {
  let ctx;
  try {
    ctx = await requireTenantContext();
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof NoTenantContextError) {
      return null;
    }
    throw error;
  }

  const memberships = await listTenantMembershipsByUser(ctx.userId);
  return {
    activeOrgId: ctx.tenantId,
    options: toTenantOptions(memberships, ctx.tenantId),
    canSwitch: isSwitcherEligible(memberships.length),
  };
}
