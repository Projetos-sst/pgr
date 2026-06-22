jest.mock("@/shared/db/repositories/orgs", () => ({ createTenant: jest.fn() }));
jest.mock("@/shared/db/repositories/org-memberships", () => ({
  ensureOwnerMembership: jest.fn(),
  listTenantMembershipsByUser: jest.fn(),
}));
jest.mock("@/shared/tenant/audit-log", () => ({ logTenantEvent: jest.fn() }));

import { createTenant } from "@/shared/db/repositories/orgs";
import {
  ensureOwnerMembership,
  listTenantMembershipsByUser,
  type TenantMembershipRow,
} from "@/shared/db/repositories/org-memberships";
import { logTenantEvent } from "@/shared/tenant/audit-log";
import { provisionPersonalTenant } from "@/shared/tenant/provision-personal-tenant";

const mockedCreateTenant = createTenant as jest.MockedFunction<typeof createTenant>;
const mockedEnsureOwner = ensureOwnerMembership as jest.MockedFunction<
  typeof ensureOwnerMembership
>;
const mockedList = listTenantMembershipsByUser as jest.MockedFunction<
  typeof listTenantMembershipsByUser
>;
const mockedLog = logTenantEvent as jest.MockedFunction<typeof logTenantEvent>;

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

function fakeTenant(id: string) {
  return {
    id,
    name: null,
    slug: null,
    imageUrl: null,
    plan: "free",
    clerkOrgId: null,
    createdAt: new Date("2026-06-19T00:00:00Z"),
    updatedAt: new Date("2026-06-19T00:00:00Z"),
  };
}

describe("provisionPersonalTenant", () => {
  beforeEach(() => jest.clearAllMocks());

  it("cria orgs(plan=free)+membership owner e loga só na criação (FR-001/003)", async () => {
    mockedList.mockResolvedValue([]);
    mockedCreateTenant.mockResolvedValue(fakeTenant("tenant_new"));

    const result = await provisionPersonalTenant({ userId: "user_1", name: "Ada" });

    expect(result).toEqual({ tenantId: "tenant_new", created: true });
    expect(mockedCreateTenant).toHaveBeenCalledWith({ name: "Ada" });
    expect(mockedEnsureOwner).toHaveBeenCalledWith({
      orgId: "tenant_new",
      userId: "user_1",
    });
    expect(mockedLog).toHaveBeenCalledWith("info", {
      operation: "tenant.provisioned",
      outcome: "ok",
      orgId: "tenant_new",
      userId: "user_1",
    });
  });

  it("idempotente: já existe owner de tenant pessoal → no-op, sem 2º tenant nem log (Inv-3/SC-008)", async () => {
    mockedList.mockResolvedValue([membership({ orgId: "tenant_existing" })]);

    const result = await provisionPersonalTenant({ userId: "user_1" });

    expect(result).toEqual({ tenantId: "tenant_existing", created: false });
    expect(mockedCreateTenant).not.toHaveBeenCalled();
    expect(mockedEnsureOwner).not.toHaveBeenCalled();
    expect(mockedLog).not.toHaveBeenCalled();
  });

  it("só vínculos não-pessoais (colaborador de tenant PRO) → cria tenant pessoal próprio", async () => {
    mockedList.mockResolvedValue([
      membership({
        orgId: "pro_tenant",
        role: "collaborator",
        clerkOrgId: "clerk_x",
        plan: "pro",
      }),
    ]);
    mockedCreateTenant.mockResolvedValue(fakeTenant("tenant_personal"));

    const result = await provisionPersonalTenant({ userId: "user_1" });

    expect(result).toEqual({ tenantId: "tenant_personal", created: true });
    expect(mockedCreateTenant).toHaveBeenCalledWith({ name: null });
  });

  it("não deriva plano/tenant de input do cliente — só usa userId", async () => {
    mockedList.mockResolvedValue([]);
    mockedCreateTenant.mockResolvedValue(fakeTenant("tenant_new"));

    await provisionPersonalTenant({ userId: "user_1" });

    // createTenant é chamado sem plan/clerkOrgId vindo de fora → default free no repo.
    expect(mockedCreateTenant).toHaveBeenCalledWith({ name: null });
  });
});
