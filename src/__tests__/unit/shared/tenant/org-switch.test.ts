jest.mock("@/shared/tenant/audit-log", () => ({ logTenantEvent: jest.fn() }));

import { reconcileActiveOrg } from "@/shared/tenant/org-switch";
import { logTenantEvent } from "@/shared/tenant/audit-log";

const mockedLog = logTenantEvent as jest.MockedFunction<typeof logTenantEvent>;

describe("reconcileActiveOrg", () => {
  beforeEach(() => mockedLog.mockReset());

  it("loga tenant.org_switched quando a org ativa muda em relação à última observada", () => {
    const result = reconcileActiveOrg({
      activeOrgId: "org_b",
      lastSeenOrgId: "org_a",
      userId: "user_1",
    });

    expect(result).toEqual({ switched: true, nextCookieValue: "org_b" });
    expect(mockedLog).toHaveBeenCalledWith("info", {
      operation: "tenant.org_switched",
      outcome: "ok",
      orgId: "org_b",
      userId: "user_1",
      requestId: undefined,
    });
  });

  it("não loga no primeiro acesso (sem org previamente observada)", () => {
    const result = reconcileActiveOrg({ activeOrgId: "org_a", lastSeenOrgId: null });
    expect(result).toEqual({ switched: false, nextCookieValue: "org_a" });
    expect(mockedLog).not.toHaveBeenCalled();
  });

  it("não loga quando a org ativa permanece a mesma", () => {
    reconcileActiveOrg({ activeOrgId: "org_a", lastSeenOrgId: "org_a" });
    expect(mockedLog).not.toHaveBeenCalled();
  });

  it("limpa o marcador quando não há org ativa", () => {
    const result = reconcileActiveOrg({ activeOrgId: null, lastSeenOrgId: "org_a" });
    expect(result).toEqual({ switched: false, nextCookieValue: null });
    expect(mockedLog).not.toHaveBeenCalled();
  });
});
