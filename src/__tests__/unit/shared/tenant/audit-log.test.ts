import { logTenantEvent } from "@/shared/tenant/audit-log";

describe("logTenantEvent", () => {
  let infoSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("emite uma linha JSON em console.log com correlação completa", () => {
    logTenantEvent("info", {
      operation: "tenant.org_switched",
      outcome: "ok",
      orgId: "org_a",
      userId: "user_1",
      requestId: "req_1",
    });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(infoSpy.mock.calls[0][0] as string)).toEqual({
      level: "info",
      operation: "tenant.org_switched",
      outcome: "ok",
      orgId: "org_a",
      userId: "user_1",
      requestId: "req_1",
    });
  });

  it("emite eventos de rejeição via console.error", () => {
    logTenantEvent("error", {
      operation: "tenant.cross_tenant_rejected",
      outcome: "rejected",
      orgId: "org_a",
    });

    expect(infoSpy).not.toHaveBeenCalled();
    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("error");
    expect(parsed.operation).toBe("tenant.cross_tenant_rejected");
  });

  it("nunca serializa chaves de PII/segredos", () => {
    logTenantEvent("info", {
      operation: "tenant.access_blocked_no_org",
      outcome: "blocked",
      userId: "user_1",
      orgId: null,
    });

    const parsed = JSON.parse(infoSpy.mock.calls[0][0] as string);
    const allowed = new Set([
      "level",
      "operation",
      "outcome",
      "requestId",
      "orgId",
      "userId",
    ]);
    for (const key of Object.keys(parsed)) {
      expect(allowed.has(key)).toBe(true);
    }
    for (const forbidden of ["name", "email", "cpf", "password", "token", "secret"]) {
      expect(parsed).not.toHaveProperty(forbidden);
    }
  });
});
