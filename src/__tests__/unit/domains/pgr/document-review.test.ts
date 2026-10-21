import { pgrReviewDecisionSchema } from "@/shared/domains/pgr/document-review";
const decision = {
  expectedLatestDecisionId: null,
  status: "accepted",
  reviewer: {
    fullName: "Avaliador fictício",
    profession: "Profissão declarada",
    registration: { kind: "not_applicable", reason: "Justificativa declarada" },
  },
  reviewedAt: "2026-01-01T10:00:00Z",
  evidenceReference: "GED:parecer-fictício",
  reason: "Parecer recebido",
  findings: [],
};
const finding = {
  key: "ACH-1",
  location: "Inventário",
  description: "Divergência fictícia",
  severity: "blocking",
  resolution: "open",
  correctionReference: null,
};
it("records a received opinion only with professional identity, evidence and date", () => {
  expect(pgrReviewDecisionSchema.safeParse(decision).success).toBe(true);
  expect(
    pgrReviewDecisionSchema.safeParse({ ...decision, evidenceReference: "" }).success,
  ).toBe(false);
});
it("rejects favorable opinions with open blocking findings and corrections without reference", () => {
  expect(
    pgrReviewDecisionSchema.safeParse({ ...decision, findings: [finding] }).success,
  ).toBe(false);
  expect(
    pgrReviewDecisionSchema.safeParse({
      ...decision,
      findings: [{ ...finding, resolution: "resolved" }],
    }).success,
  ).toBe(false);
});
it("requires open findings for changes requested and unique stable keys", () => {
  expect(
    pgrReviewDecisionSchema.safeParse({ ...decision, status: "changes_requested" })
      .success,
  ).toBe(false);
  expect(
    pgrReviewDecisionSchema.safeParse({
      ...decision,
      status: "changes_requested",
      findings: [finding, finding],
    }).success,
  ).toBe(false);
});
it("does not accept a forged recording actor or missing optimistic state", () => {
  expect(
    pgrReviewDecisionSchema.safeParse({ ...decision, recordedBy: "forged" }).success,
  ).toBe(false);
  const { expectedLatestDecisionId: _token, ...withoutToken } = decision;
  expect(pgrReviewDecisionSchema.safeParse(withoutToken).success).toBe(false);
});
