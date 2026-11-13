import {
  ACCESS_AREA_MODULE,
  accessScopeGrantSchema,
  allowedAreas,
  isScopeRestricted,
} from "@/shared/domains/platform/access-scopes";

const COMPANY = "11111111-1111-1111-1111-111111111111";
const WORK_UNIT = "11111111-1111-1111-1111-1111111111a1";

describe("member access scopes", () => {
  it("keeps the legacy full access until the first scope is granted", () => {
    expect(isScopeRestricted("collaborator", 0)).toBe(false);
    expect(allowedAreas("collaborator", [])).toEqual(["safety", "health"]);
    expect(allowedAreas("client", [])).toEqual(["safety", "health"]);
  });

  it("never restricts the owner, even with scope rows", () => {
    expect(isScopeRestricted("owner", 3)).toBe(false);
    expect(allowedAreas("owner", [{ area: "health" }])).toEqual(["safety", "health"]);
  });

  it("limits a scoped collaborator to the granted areas", () => {
    expect(isScopeRestricted("collaborator", 1)).toBe(true);
    expect(allowedAreas("collaborator", [{ area: "health" }])).toEqual(["health"]);
    expect(allowedAreas("collaborator", [{ area: "safety" }])).toEqual(["safety"]);
    expect(
      allowedAreas("collaborator", [{ area: "health" }, { area: "safety" }]),
    ).toEqual(["safety", "health"]);
    expect(allowedAreas("client", [{ area: "safety" }])).toEqual(["safety"]);
  });

  it("maps each area to the contracted service it depends on", () => {
    expect(ACCESS_AREA_MODULE).toEqual({ safety: "pgr", health: "medicine" });
  });

  it("accepts company-wide and work-unit grants and rejects anything else", () => {
    expect(accessScopeGrantSchema.parse({ companyId: COMPANY, area: "safety" })).toEqual({
      companyId: COMPANY,
      area: "safety",
    });
    expect(
      accessScopeGrantSchema.parse({
        companyId: COMPANY,
        workUnitId: WORK_UNIT,
        area: "health",
      }),
    ).toEqual({ companyId: COMPANY, workUnitId: WORK_UNIT, area: "health" });
    expect(
      accessScopeGrantSchema.parse({ companyId: COMPANY, workUnitId: "", area: "health" })
        .workUnitId,
    ).toBeUndefined();
    for (const input of [
      { companyId: COMPANY, area: "pgr" },
      { companyId: "not-a-uuid", area: "safety" },
      { companyId: COMPANY, workUnitId: "x", area: "safety" },
      { area: "safety" },
      { companyId: COMPANY, area: "safety", orgId: "org_b" },
      { companyId: COMPANY, area: "safety", userId: "someone" },
    ]) {
      expect(accessScopeGrantSchema.safeParse(input).success).toBe(false);
    }
  });
});
