jest.mock("@/shared/tenant/audit-log", () => ({ logTenantEvent: jest.fn() }));

import { auth } from "@clerk/nextjs/server";

import { meAction } from "@/shared/server/actions/me";
import { reconcileActiveOrg } from "@/shared/tenant/org-switch";
import { logTenantEvent } from "@/shared/tenant/audit-log";

const mockedAuth = auth as jest.MockedFunction<typeof auth>;
const mockedLog = logTenantEvent as jest.MockedFunction<typeof logTenantEvent>;

const setActiveOrg = (orgId: string) =>
  mockedAuth.mockResolvedValue({
    isAuthenticated: true,
    userId: "user_1",
    sessionId: "sess_1",
    orgId,
    orgRole: "org:member",
    orgSlug: null,
  } as unknown as Awaited<ReturnType<typeof auth>>);

describe("troca de organização ativa", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedLog.mockReset();
  });

  it("a leitura usa sempre o orgId ativo da sessão (sem cache cruzado entre tenants)", async () => {
    setActiveOrg("org_a");
    await expect(meAction()).resolves.toEqual({
      ok: true,
      userId: "user_1",
      orgId: "org_a",
    });

    setActiveOrg("org_b");
    await expect(meAction()).resolves.toEqual({
      ok: true,
      userId: "user_1",
      orgId: "org_b",
    });
  });

  it("registra tenant.org_switched no ponto de entrada pós-troca (FR-020/SC-013)", () => {
    reconcileActiveOrg({
      activeOrgId: "org_b",
      lastSeenOrgId: "org_a",
      userId: "user_1",
    });

    expect(mockedLog).toHaveBeenCalledWith(
      "info",
      expect.objectContaining({ operation: "tenant.org_switched", orgId: "org_b" }),
    );
  });
});
