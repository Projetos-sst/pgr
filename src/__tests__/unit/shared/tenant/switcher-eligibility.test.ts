jest.mock("@/shared/db/repositories/orgs", () => ({ createTenant: jest.fn() }));
jest.mock("@/shared/db/repositories/org-memberships", () => ({
  ensureOwnerMembership: jest.fn(),
  listTenantMembershipsByUser: jest.fn(),
}));
jest.mock("@/shared/tenant/provision-personal-tenant", () => ({
  provisionPersonalTenant: jest.fn(),
}));

import type { TenantMembershipRow } from "@/shared/db/repositories/org-memberships";
import { isSwitcherEligible, selectActiveTenant } from "@/shared/tenant/active-tenant";

function membership(over: Partial<TenantMembershipRow>): TenantMembershipRow {
  return {
    orgId: "tenant_1",
    role: "owner",
    scopedCompanyId: null,
    plan: "free",
    clerkOrgId: null,
    ...over,
  };
}

describe("isSwitcherEligible (FR-020/SC-010)", () => {
  it("1 vínculo → false; 2+ → true", () => {
    expect(isSwitcherEligible(1)).toBe(false);
    expect(isSwitcherEligible(2)).toBe(true);
    expect(isSwitcherEligible(3)).toBe(true);
  });
});

describe("coexistência aditiva de memberships (2º vínculo não substitui o 1º — SC-008)", () => {
  it("dono do próprio + colaborador de terceiro coexistem; count reflete os dois", () => {
    const memberships = [
      membership({ orgId: "meu_tenant", role: "owner", clerkOrgId: null }),
      membership({
        orgId: "tenant_terceiro",
        role: "collaborator",
        clerkOrgId: "clerk_x",
        plan: "pro",
      }),
    ];

    expect(selectActiveTenant(memberships, "meu_tenant")?.membershipCount).toBe(2);
    expect(selectActiveTenant(memberships, "tenant_terceiro")?.membershipCount).toBe(2);
    expect(isSwitcherEligible(memberships.length)).toBe(true);
  });
});
