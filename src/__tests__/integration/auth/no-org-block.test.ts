jest.mock("@/shared/tenant/audit-log", () => ({ logTenantEvent: jest.fn() }));

import { auth } from "@clerk/nextjs/server";

import { meAction } from "@/shared/server/actions/me";
import { logTenantEvent } from "@/shared/tenant/audit-log";

const mockedAuth = auth as jest.MockedFunction<typeof auth>;
const mockedLog = logTenantEvent as jest.MockedFunction<typeof logTenantEvent>;

describe("bloqueio de Server Action sem org ativa (US8)", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedLog.mockReset();
  });

  it("autenticado sem org → bloqueia antes do acesso ao banco e emite tenant.access_blocked_no_org", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_1",
      sessionId: "sess_1",
      orgId: null,
      orgRole: null,
      orgSlug: null,
    } as unknown as Awaited<ReturnType<typeof auth>>);

    await expect(meAction()).resolves.toEqual({ ok: false, error: "NO_ACTIVE_ORG" });
    expect(mockedLog).toHaveBeenCalledWith("info", {
      operation: "tenant.access_blocked_no_org",
      outcome: "blocked",
    });
  });

  it("anônimo → UNAUTHORIZED (sem acesso a dado)", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: false,
      userId: null,
      sessionId: null,
    } as unknown as Awaited<ReturnType<typeof auth>>);

    await expect(meAction()).resolves.toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(mockedLog).not.toHaveBeenCalled();
  });
});
