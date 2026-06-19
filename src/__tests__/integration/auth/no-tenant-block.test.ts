/** @jest-environment node */
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => undefined })),
}));
jest.mock("@/shared/db/repositories/org-memberships", () => ({
  listTenantMembershipsByUser: jest.fn(),
  ensureOwnerMembership: jest.fn(),
}));
jest.mock("@/shared/tenant/provision-personal-tenant", () => ({
  provisionPersonalTenant: jest.fn(async () => ({ tenantId: "x", created: false })),
}));
jest.mock("@/shared/tenant/audit-log", () => ({ logTenantEvent: jest.fn() }));

import { auth } from "@clerk/nextjs/server";

import { listTenantMembershipsByUser } from "@/shared/db/repositories/org-memberships";
import { logTenantEvent } from "@/shared/tenant/audit-log";
import { NoTenantContextError, UnauthorizedError } from "@/shared/auth/errors";
import { requireTenantContext } from "@/shared/auth/require-tenant-context";

const mockedAuth = auth as jest.MockedFunction<typeof auth>;
const mockedList = listTenantMembershipsByUser as jest.MockedFunction<
  typeof listTenantMembershipsByUser
>;
const mockedLog = logTenantEvent as jest.MockedFunction<typeof logTenantEvent>;

function authenticated() {
  mockedAuth.mockResolvedValue({
    isAuthenticated: true,
    userId: "user_1",
    sessionId: "sess_1",
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

describe("requireTenantContext — bloqueio sem tenant ativo (FR-024)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("autenticado sem membership resolvível (self-heal falho) → NoTenantContextError + log blocked", async () => {
    authenticated();
    mockedList.mockResolvedValue([]);

    await expect(requireTenantContext()).rejects.toBeInstanceOf(NoTenantContextError);
    expect(mockedLog).toHaveBeenCalledWith("error", {
      operation: "tenant.context",
      outcome: "blocked",
      userId: "user_1",
    });
  });

  it("anônimo → UnauthorizedError antes de qualquer acesso a dados", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: false,
      userId: null,
      sessionId: null,
    } as unknown as Awaited<ReturnType<typeof auth>>);

    await expect(requireTenantContext()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mockedList).not.toHaveBeenCalled();
  });

  it("autenticado com 1 membership → resolve contexto (sem bloqueio)", async () => {
    authenticated();
    mockedList.mockResolvedValue([
      {
        orgId: "tenant_1",
        role: "owner",
        scopedCompanyId: null,
        plan: "free",
        clerkOrgId: null,
      },
    ]);

    await expect(requireTenantContext()).resolves.toEqual({
      userId: "user_1",
      tenantId: "tenant_1",
      plan: "free",
      role: "owner",
    });
  });
});
