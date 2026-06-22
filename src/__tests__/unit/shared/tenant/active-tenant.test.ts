jest.mock("@/shared/db/repositories/orgs", () => ({ createTenant: jest.fn() }));
jest.mock("@/shared/db/repositories/org-memberships", () => ({
  ensureOwnerMembership: jest.fn(),
  listTenantMembershipsByUser: jest.fn(),
}));
jest.mock("@/shared/tenant/provision-personal-tenant", () => ({
  provisionPersonalTenant: jest.fn(),
}));

import {
  listTenantMembershipsByUser,
  type TenantMembershipRow,
} from "@/shared/db/repositories/org-memberships";
import { provisionPersonalTenant } from "@/shared/tenant/provision-personal-tenant";
import {
  isSwitcherEligible,
  resolveActiveTenant,
  selectActiveTenant,
  toDomainRole,
} from "@/shared/tenant/active-tenant";

const mockedList = listTenantMembershipsByUser as jest.MockedFunction<
  typeof listTenantMembershipsByUser
>;
const mockedProvision = provisionPersonalTenant as jest.MockedFunction<
  typeof provisionPersonalTenant
>;

function membership(over: Partial<TenantMembershipRow>): TenantMembershipRow {
  return {
    orgId: "tenant_1",
    name: null,
    role: "owner",
    scopedCompanyId: null,
    plan: "free",
    clerkOrgId: null,
    ...over,
  };
}

describe("selectActiveTenant", () => {
  it("1 vínculo → esse tenant (cookie irrelevante)", () => {
    const active = selectActiveTenant(
      [membership({ orgId: "t1", name: "Acme" })],
      "outro_id_do_cliente",
    );
    expect(active).toEqual({
      tenantId: "t1",
      name: "Acme",
      plan: "free",
      role: "owner",
      membershipCount: 1,
    });
  });

  it("0 vínculos → null", () => {
    expect(selectActiveTenant([], null)).toBeNull();
  });

  it("normaliza papel do Clerk → domínio (org:admin de pro vira owner)", () => {
    const active = selectActiveTenant(
      [membership({ orgId: "pro_t", plan: "pro", role: "org:admin" })],
      null,
    );
    expect(active?.role).toBe("owner");
  });

  describe("2+ vínculos", () => {
    const memberships = [
      membership({ orgId: "minha_org", role: "owner", clerkOrgId: null, plan: "free" }),
      membership({
        orgId: "org_terceiro",
        role: "org:member",
        clerkOrgId: "clerk_x",
        plan: "pro",
      }),
    ];

    it("cookie aponta a um membership válido → esse", () => {
      expect(selectActiveTenant(memberships, "org_terceiro")?.tenantId).toBe(
        "org_terceiro",
      );
      expect(selectActiveTenant(memberships, "minha_org")?.tenantId).toBe("minha_org");
    });

    it("sem cookie ou cookie inválido → default na org pessoal (owner, sem Clerk)", () => {
      expect(selectActiveTenant(memberships, null)?.tenantId).toBe("minha_org");
      expect(selectActiveTenant(memberships, "id_forjado")?.tenantId).toBe("minha_org");
    });

    it("sem org pessoal (só colaborações) → fallback determinístico (menor orgId)", () => {
      const onlyCollabs = [
        membership({ orgId: "org_z", role: "org:member", clerkOrgId: "c_z" }),
        membership({ orgId: "org_a", role: "org:member", clerkOrgId: "c_a" }),
      ];
      expect(selectActiveTenant(onlyCollabs, null)?.tenantId).toBe("org_a");
    });
  });
});

describe("toDomainRole", () => {
  it("mapeia papéis do Clerk para o vocabulário de domínio", () => {
    expect(toDomainRole("org:admin")).toBe("owner");
    expect(toDomainRole("org:member")).toBe("collaborator");
    expect(toDomainRole("org:client")).toBe("client");
  });

  it("preserva papéis de domínio já normalizados", () => {
    expect(toDomainRole("owner")).toBe("owner");
    expect(toDomainRole("collaborator")).toBe("collaborator");
    expect(toDomainRole("client")).toBe("client");
  });

  it("papel desconhecido cai em client (menor privilégio)", () => {
    expect(toDomainRole("org:billing")).toBe("client");
    expect(toDomainRole("")).toBe("client");
  });
});

describe("resolveActiveTenant", () => {
  beforeEach(() => jest.clearAllMocks());

  it("1 membership → resolve sem provisionar", async () => {
    mockedList.mockResolvedValue([membership({ orgId: "t1", plan: "pro" })]);
    const active = await resolveActiveTenant("user_1");
    expect(active?.tenantId).toBe("t1");
    expect(active?.plan).toBe("pro");
    expect(mockedProvision).not.toHaveBeenCalled();
  });

  it("0 memberships → self-heal (provisiona) e re-resolve", async () => {
    mockedList
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([membership({ orgId: "tenant_healed" })]);
    mockedProvision.mockResolvedValue({ tenantId: "tenant_healed", created: true });

    const active = await resolveActiveTenant("user_1");

    expect(mockedProvision).toHaveBeenCalledWith({ userId: "user_1" });
    expect(active?.tenantId).toBe("tenant_healed");
  });

  it("tenant nunca vem de input do cliente: cookie inválido com 1 vínculo é ignorado", async () => {
    mockedList.mockResolvedValue([membership({ orgId: "meu_tenant" })]);
    const active = await resolveActiveTenant("user_1", "tenant_forjado_no_body");
    expect(active?.tenantId).toBe("meu_tenant");
  });
});

describe("isSwitcherEligible", () => {
  it("1 → false; 2+ → true; 0 → false (SC-010/FR-020)", () => {
    expect(isSwitcherEligible(0)).toBe(false);
    expect(isSwitcherEligible(1)).toBe(false);
    expect(isSwitcherEligible(2)).toBe(true);
    expect(isSwitcherEligible(5)).toBe(true);
  });
});
