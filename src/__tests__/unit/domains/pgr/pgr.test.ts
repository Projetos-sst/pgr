import {
  pgrInputSchema,
  pgrCreateSchema,
  type PgrCreateInput,
  type PgrInput,
} from "@/shared/domains/pgr/pgr";

const COMPANY = "11111111-1111-1111-1111-111111111111";
const WORK_UNIT = "11111111-1111-1111-1111-1111111111a1";

const baseValues: PgrInput = {
  companyId: COMPANY,
  registrationType: "not_applicable",
  issuedAt: "2026-01-10",
  validUntil: "2027-01-10",
};

const createBase: PgrCreateInput = { ...baseValues, declarationAccepted: true };

describe("pgrCreateSchema (US1/US2)", () => {
  it("aceita criação válida (com aceite) e mantém os valores", () => {
    const parsed = pgrCreateSchema.parse(createBase);
    expect(parsed.companyId).toBe(COMPANY);
    expect(parsed.registrationType).toBe("not_applicable");
    expect(parsed.issuedAt).toBe("2026-01-10");
    expect(parsed.declarationAccepted).toBe(true);
  });

  it("rejeita criação sem aceite da declaração", () => {
    const { declarationAccepted: _omit, ...withoutAccept } = createBase;
    expect(() => pgrCreateSchema.parse(withoutAccept)).toThrow();
    expect(() =>
      pgrCreateSchema.parse({ ...createBase, declarationAccepted: false }),
    ).toThrow();
  });

  it("aceita obra opcional válida e normaliza responsável vazio", () => {
    const parsed = pgrCreateSchema.parse({
      ...createBase,
      workUnitId: WORK_UNIT,
      responsible: "",
    });
    expect(parsed.workUnitId).toBe(WORK_UNIT);
    expect(parsed.responsible).toBeUndefined();
  });
});

describe("pgrInputSchema — datas e registro (US1)", () => {
  it("rejeita validade anterior à emissão", () => {
    expect(() =>
      pgrInputSchema.parse({
        ...baseValues,
        issuedAt: "2026-06-01",
        validUntil: "2026-01-01",
      }),
    ).toThrow();
  });

  it("exige número de registro para CRM/CREA/MTE", () => {
    for (const registrationType of ["crm", "crea", "mte"] as const) {
      expect(() => pgrInputSchema.parse({ ...baseValues, registrationType })).toThrow();
      expect(
        pgrInputSchema.parse({
          ...baseValues,
          registrationType,
          registrationNumber: "SP-123456",
        }).registrationNumber,
      ).toBe("SP-123456");
    }
  });

  it("rejeita número de registro quando tipo é 'não aplicável'", () => {
    expect(() =>
      pgrInputSchema.parse({
        ...baseValues,
        registrationType: "not_applicable",
        registrationNumber: "SP-123456",
      }),
    ).toThrow();
  });

  it("aceita update de corpo completo válido (sem declarationAccepted)", () => {
    const parsed = pgrInputSchema.parse({
      ...baseValues,
      responsible: "Eng. Fulano",
      workUnitId: WORK_UNIT,
    });
    expect(parsed.responsible).toBe("Eng. Fulano");
    expect("declarationAccepted" in parsed).toBe(false);
  });

  it("rejeita UUID de empresa inválido; trata workUnitId vazio como undefined", () => {
    expect(() => pgrInputSchema.parse({ ...baseValues, companyId: "x" })).toThrow();
    expect(
      pgrInputSchema.parse({ ...baseValues, workUnitId: "" }).workUnitId,
    ).toBeUndefined();
  });

  it("exige emissão e validade (datas obrigatórias)", () => {
    const { issuedAt: _i, ...noIssued } = baseValues;
    const { validUntil: _v, ...noValid } = baseValues;
    expect(() => pgrInputSchema.parse(noIssued)).toThrow();
    expect(() => pgrInputSchema.parse(noValid)).toThrow();
  });
});
