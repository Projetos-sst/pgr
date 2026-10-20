import {
  companyModuleChangeSchema,
  moduleIsEnabled,
} from "@/shared/domains/platform/company-modules";

describe("company module access", () => {
  it("denies absent/disabled entitlements and keeps modules independent", () => {
    expect(moduleIsEnabled([], "pgr")).toBe(false);
    expect(moduleIsEnabled([{ module: "pgr", enabled: false }], "pgr")).toBe(false);
    expect(moduleIsEnabled([{ module: "medicine", enabled: true }], "pgr")).toBe(false);
    expect(moduleIsEnabled([{ module: "medicine", enabled: true }], "medicine")).toBe(
      true,
    );
  });
  it("requires an explicit boolean, known service and audit reason", () => {
    expect(
      companyModuleChangeSchema.safeParse({
        module: "pgr",
        enabled: true,
        reason: "Contrato autorizado",
      }).success,
    ).toBe(true);
    for (const input of [
      { module: "pro", enabled: true, reason: "x" },
      { module: "pgr", enabled: "true", reason: "x" },
      { module: "pgr", enabled: true, reason: " " },
      { module: "pgr", enabled: true, reason: "x", orgId: "other" },
    ]) {
      expect(companyModuleChangeSchema.safeParse(input).success).toBe(false);
    }
  });
});
