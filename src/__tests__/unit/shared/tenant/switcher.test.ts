jest.mock("@/shared/db/repositories/orgs", () => ({ createTenant: jest.fn() }));
jest.mock("@/shared/db/repositories/org-memberships", () => ({
  ensureOwnerMembership: jest.fn(),
  listTenantMembershipsByUser: jest.fn(),
}));
jest.mock("@/shared/tenant/provision-personal-tenant", () => ({
  provisionPersonalTenant: jest.fn(),
}));
jest.mock("@/shared/auth/require-tenant-context", () => ({
  requireTenantContext: jest.fn(),
}));

import type { TenantMembershipRow } from "@/shared/db/repositories/org-memberships";
import { toTenantOptions } from "@/shared/tenant/switcher";

function membership(over: Partial<TenantMembershipRow>): TenantMembershipRow {
  return {
    orgId: "o1",
    name: null,
    role: "owner",
    scopedCompanyId: null,
    plan: "free",
    clerkOrgId: null,
    ...over,
  };
}

describe("toTenantOptions", () => {
  it("mapeia nome, papel de domínio e plano; marca a org ativa", () => {
    const options = toTenantOptions(
      [
        membership({ orgId: "pessoal", role: "owner", clerkOrgId: null, plan: "free" }),
        membership({
          orgId: "super",
          name: "SuperPro LTDA",
          role: "org:member",
          clerkOrgId: "clerk_x",
          plan: "pro",
        }),
      ],
      "super",
    );

    const pessoal = options.find((option) => option.orgId === "pessoal");
    const superPro = options.find((option) => option.orgId === "super");
    expect(pessoal).toMatchObject({
      name: "Minha organização",
      roleLabel: "você",
      plan: "free",
      isActive: false,
    });
    expect(superPro).toMatchObject({
      name: "SuperPro LTDA",
      roleLabel: "colaborador",
      plan: "pro",
      isActive: true,
    });
  });

  it("ordena a org ativa em primeiro", () => {
    const options = toTenantOptions(
      [
        membership({ orgId: "a", name: "AAA" }),
        membership({ orgId: "b", name: "BBB", role: "org:member", clerkOrgId: "c" }),
      ],
      "b",
    );
    expect(options[0].orgId).toBe("b");
  });

  it("fallback de nome distingue org pessoal de colaboração sem nome", () => {
    const options = toTenantOptions(
      [
        membership({ orgId: "p", name: null, clerkOrgId: null }),
        membership({ orgId: "c", name: null, role: "org:member", clerkOrgId: "clerk_y" }),
      ],
      "p",
    );
    expect(options.find((option) => option.orgId === "p")?.name).toBe(
      "Minha organização",
    );
    expect(options.find((option) => option.orgId === "c")?.name).toBe("Organização");
  });
});
