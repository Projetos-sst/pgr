jest.mock("@/shared/db/repositories/orgs", () => ({ createTenant: jest.fn() }));
jest.mock("@/shared/db/repositories/org-memberships", () => ({
  ensureOwnerMembership: jest.fn(),
  listTenantMembershipsByUser: jest.fn(),
}));
jest.mock("@/shared/tenant/provision-personal-tenant", () => ({
  provisionPersonalTenant: jest.fn(),
}));

import type { TenantMembershipRow } from "@/shared/db/repositories/org-memberships";
import { selectActiveTenant } from "@/shared/tenant/active-tenant";
import { isTeamManagementAvailable } from "@/shared/tenant/plan";

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

describe("isTeamManagementAvailable (campo apenas — sem enforcement)", () => {
  it("free → false; pro → true (Gate PRO futuro)", () => {
    expect(isTeamManagementAvailable("free")).toBe(false);
    expect(isTeamManagementAvailable("pro")).toBe(true);
  });
});

describe("plano resolvido pelo tenant ATIVO (Inv-1), não por plano global do usuário", () => {
  it("usuário com vínculo free e pro → plano vem do tenant ativo selecionado", () => {
    const memberships = [
      membership({ orgId: "free_t", plan: "free" }),
      membership({ orgId: "pro_t", plan: "pro" }),
    ];

    expect(selectActiveTenant(memberships, "pro_t")?.plan).toBe("pro");
    expect(selectActiveTenant(memberships, "free_t")?.plan).toBe("free");
  });

  it("default free: tenant sem plano explícito é tratado como free", () => {
    expect(
      selectActiveTenant([membership({ orgId: "t1", plan: "free" })], null)?.plan,
    ).toBe("free");
  });
});
