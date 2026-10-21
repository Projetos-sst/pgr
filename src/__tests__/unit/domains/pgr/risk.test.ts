import { riskInputSchema, type RiskInput } from "@/shared/domains/pgr/risk";

const GES = "11111111-1111-1111-1111-1111111111a2";

const baseValues: RiskInput = {
  gesId: GES,
  agentType: "physical",
  description: "Ruído contínuo acima de 85 dB(A)",
};

describe("riskInputSchema — obrigatórios e enums (US1)", () => {
  it("accepts optional context and validates its identifiers without requiring it for legacy clients", () => {
    expect(riskInputSchema.safeParse(baseValues).success).toBe(true);
    expect(
      riskInputSchema.safeParse({ ...baseValues, companyId: "invalid" }).success,
    ).toBe(false);
    expect(
      riskInputSchema.safeParse({ ...baseValues, workUnitId: "invalid" }).success,
    ).toBe(false);
    const parsed = riskInputSchema.parse({
      ...baseValues,
      companyId: GES,
      workUnitId: GES,
    });
    expect(parsed.companyId).toBe(GES);
    expect(parsed.workUnitId).toBe(GES);
  });
  it("aceita create/update válido e normaliza opcionais vazios", () => {
    const parsed = riskInputSchema.parse({
      ...baseValues,
      hazard: "",
      sources: "",
      exposureTime: "",
      measurementUnit: "",
    });
    expect(parsed.gesId).toBe(GES);
    expect(parsed.agentType).toBe("physical");
    expect(parsed.description).toBe("Ruído contínuo acima de 85 dB(A)");
    expect(parsed.hazard).toBeUndefined();
    expect(parsed.exposureTime).toBeUndefined();
    expect(parsed.measurementUnit).toBeUndefined();
  });

  it("aceita update de corpo completo com todos os campos", () => {
    const parsed = riskInputSchema.parse({
      ...baseValues,
      hazard: "Ruído",
      sources: "Compressores",
      propagation: "Ar",
      exposureTime: "gt_7h",
      possibleInjuries: "PAIR",
      noxiousAgentCode: "01.01.001",
      measurementUnit: "db_a",
      concentrationIntensity: "87.5",
    });
    expect(parsed.exposureTime).toBe("gt_7h");
    expect(parsed.concentrationIntensity).toBe("87.5");
  });

  it("rejeita gesId inválido", () => {
    expect(() => riskInputSchema.parse({ ...baseValues, gesId: "x" })).toThrow();
  });

  it("exige agentType e description", () => {
    const { agentType: _a, ...noAgent } = baseValues;
    const { description: _d, ...noDesc } = baseValues;
    expect(() => riskInputSchema.parse(noAgent)).toThrow();
    expect(() => riskInputSchema.parse(noDesc)).toThrow();
    expect(() => riskInputSchema.parse({ ...baseValues, description: "" })).toThrow();
  });

  it("rejeita enum inválido (agentType/exposureTime)", () => {
    expect(() =>
      riskInputSchema.parse({ ...baseValues, agentType: "nuclear" }),
    ).toThrow();
    expect(() =>
      riskInputSchema.parse({ ...baseValues, exposureTime: "sometimes" }),
    ).toThrow();
  });
});

describe("riskInputSchema — regra qualitative_na (US1)", () => {
  it("rejeita concentração com unidade qualitative_na", () => {
    expect(() =>
      riskInputSchema.parse({
        ...baseValues,
        measurementUnit: "qualitative_na",
        concentrationIntensity: "5",
      }),
    ).toThrow();
  });

  it("rejeita concentração sem unidade de medida", () => {
    expect(() =>
      riskInputSchema.parse({ ...baseValues, concentrationIntensity: "5" }),
    ).toThrow();
  });

  it("aceita concentração com unidade quantitativa", () => {
    const parsed = riskInputSchema.parse({
      ...baseValues,
      measurementUnit: "db_a",
      concentrationIntensity: "87.5",
    });
    expect(parsed.concentrationIntensity).toBe("87.5");
    expect(parsed.measurementUnit).toBe("db_a");
  });

  it("aceita concentração ausente mesmo com qualitative_na", () => {
    const parsed = riskInputSchema.parse({
      ...baseValues,
      measurementUnit: "qualitative_na",
    });
    expect(parsed.concentrationIntensity).toBeUndefined();
    expect(parsed.measurementUnit).toBe("qualitative_na");
  });

  it("rejeita concentração não-decimal", () => {
    expect(() =>
      riskInputSchema.parse({
        ...baseValues,
        measurementUnit: "db_a",
        concentrationIntensity: "abc",
      }),
    ).toThrow();
  });
});
