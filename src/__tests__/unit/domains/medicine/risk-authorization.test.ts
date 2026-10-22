import {
  companyAuthorizerSchema,
  professionalAuthorizationSchema,
  medicalRiskDecisionSchema,
} from "@/shared/domains/medicine/risk-authorization";
describe("company risk authorization input", () => {
  it("requires client nomination evidence and reason, including revocation", () => {
    expect(
      companyAuthorizerSchema.safeParse({
        userId: "login",
        evidence: "",
        reason: "indicação",
      }).success,
    ).toBe(false);
    expect(
      companyAuthorizerSchema.parse({
        userId: null,
        evidence: "Ata de substituição",
        reason: "Encerramento",
      }).userId,
    ).toBeNull();
  });
  it("requires professional identity and applicable registration without inventing a council", () => {
    const base = {
      userId: "professional",
      active: true,
      reason: "Indicado para a empresa",
      identity: {
        fullName: "Nome fictício",
        profession: "Profissão declarada",
        registration: { kind: "registered", council: "Órgão informado", number: "123" },
      },
    };
    expect(professionalAuthorizationSchema.safeParse(base).success).toBe(true);
    expect(
      professionalAuthorizationSchema.safeParse({
        ...base,
        identity: {
          ...base.identity,
          registration: { kind: "registered", council: "Órgão informado" },
        },
      }).success,
    ).toBe(false);
    expect(
      professionalAuthorizationSchema.safeParse({
        ...base,
        identity: {
          ...base.identity,
          registration: { kind: "not_applicable", reason: "Justificativa declarada" },
        },
      }).success,
    ).toBe(true);
  });
  it("does not require re-entering professional identity for revocation", () => {
    expect(
      professionalAuthorizationSchema.safeParse({
        userId: "professional",
        active: false,
        reason: "Revogado pela empresa",
      }).success,
    ).toBe(true);
  });
  it("requires a decision, reason, concurrency token and rejects forged actor fields", () => {
    const review = {
      status: "validated",
      reason: "Parecer registrado",
      expectedStatus: "pending",
      expectedReviewedAt: null,
    };
    expect(medicalRiskDecisionSchema.safeParse(review).success).toBe(true);
    expect(
      medicalRiskDecisionSchema.safeParse({ ...review, reviewedBy: "another" }).success,
    ).toBe(false);
    expect(medicalRiskDecisionSchema.safeParse({ ...review, reason: "" }).success).toBe(
      false,
    );
    expect(
      medicalRiskDecisionSchema.safeParse({ ...review, expectedReviewedAt: "yesterday" })
        .success,
    ).toBe(false);
  });
});
