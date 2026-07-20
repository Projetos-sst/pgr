import { pgrSignaturePayloadSchema } from "@/shared/domains/signatures/targets/pgr";

const valid = {
  documentTitle: "PGR — A Ltda",
  companyName: "A Ltda",
  workUnitName: "Obra Central",
  responsibleName: "Fulano",
  issuedAt: "2026-01-10",
  validUntil: "2027-01-10",
  revisionNumber: 3,
};

describe("pgrSignaturePayloadSchema", () => {
  it("aceita o payload mínimo completo", () => {
    expect(pgrSignaturePayloadSchema.safeParse(valid).success).toBe(true);
  });

  it("aceita nullable em workUnit/responsável/datas/revisão", () => {
    const parsed = pgrSignaturePayloadSchema.safeParse({
      ...valid,
      workUnitName: null,
      responsibleName: null,
      issuedAt: null,
      validUntil: null,
      revisionNumber: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("exige documentTitle e companyName", () => {
    expect(
      pgrSignaturePayloadSchema.safeParse({ ...valid, documentTitle: "" }).success,
    ).toBe(false);
    expect(
      pgrSignaturePayloadSchema.safeParse({ ...valid, companyName: "" }).success,
    ).toBe(false);
  });

  it("é estrito: rejeita qualquer campo de PII ou interno (sem vazamento público)", () => {
    for (const extra of [
      "orgId",
      "pgrId",
      "gesId",
      "riskId",
      "employees",
      "workers",
      "cpf",
      "email",
      "phone",
      "matricula",
      "risks",
      "measures",
      "epis",
      "plan",
      "token",
    ]) {
      const parsed = pgrSignaturePayloadSchema.safeParse({ ...valid, [extra]: "x" });
      expect(`${extra}:${parsed.success}`).toBe(`${extra}:false`);
    }
  });
});
