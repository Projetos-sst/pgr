import {
  medicalSourceInputSchema,
  medicalSourceWarnings,
  canUseMedicalRisk,
} from "@/shared/domains/medicine/risk-sources";

const input = {
  kind: "external",
  title: "PGR externo",
  reference: "GED: exemplo",
  version: "1",
  risks: [{ agentType: "physical", description: "Ruído", exposureGroup: "Produção" }],
};
describe("medical risk sources", () => {
  it("accepts structured risks without making a medical inference", () => {
    expect(medicalSourceInputSchema.safeParse(input).success).toBe(true);
  });
  it("rejects imported status, reviewer and unknown clinical fields", () => {
    for (const added of [
      { status: "validated" },
      { reviewedBy: "owner" },
      { prescribedExam: "example" },
    ]) {
      expect(
        medicalSourceInputSchema.safeParse({
          ...input,
          risks: [{ ...input.risks[0], ...added }],
        }).success,
      ).toBe(false);
    }
  });
  it("does not consider missing, pending, rejected or changed risks ready for PCMSO", () => {
    for (const state of ["pending", "rejected"] as const)
      expect(canUseMedicalRisk(state, "current")).toBe(false);
    for (const freshness of ["changed", "unavailable", "superseded"] as const)
      expect(canUseMedicalRisk("validated", freshness)).toBe(false);
    expect(canUseMedicalRisk("validated", "external_reference")).toBe(true);
    expect(medicalSourceWarnings(0, 0, "current").length).toBe(1);
    expect(medicalSourceWarnings(1, 1, "changed").length).toBe(2);
  });
  it("requires source identity and bounds import size", () => {
    expect(medicalSourceInputSchema.safeParse({ ...input, version: "" }).success).toBe(
      false,
    );
    expect(
      medicalSourceInputSchema.safeParse({
        ...input,
        risks: Array(501).fill(input.risks[0]),
      }).success,
    ).toBe(false);
  });
});
