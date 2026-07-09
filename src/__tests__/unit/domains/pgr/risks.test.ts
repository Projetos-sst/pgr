import {
  riskAgentTypeSchema,
  exposureTimeSchema,
  measurementUnitSchema,
  assessmentCriterionSchema,
  controlLevelSchema,
  pgrRegistrationTypeSchema,
  probabilitySchema,
  severitySchema,
  uncertaintyDegreeSchema,
  computeRiskLevel,
  riskAgentTypeLabel,
  exposureTimeLabel,
  controlLevelLabel,
  uncertaintyDegreeLabel,
  pgrRegistrationTypeLabel,
} from "@/shared/domains/pgr/risks";

describe("enums do módulo de Riscos & PGR", () => {
  it("risk_agent_type cobre os 7 grupos NR-01", () => {
    expect(riskAgentTypeSchema.options).toHaveLength(7);
    expect(riskAgentTypeSchema.options).toEqual([
      "physical",
      "chemical",
      "biological",
      "ergonomic",
      "mechanical",
      "accident",
      "psychosocial",
    ]);
  });

  it("exposure_time cobre as 8 faixas ePGR", () => {
    expect(exposureTimeSchema.options).toHaveLength(8);
  });

  it("control_level cobre os 4 níveis da hierarquia NR-01", () => {
    expect(controlLevelSchema.options).toEqual([
      "elimination",
      "collective_protection",
      "administrative",
      "ppe",
    ]);
  });

  it("aceita valores válidos e rejeita inválidos", () => {
    expect(measurementUnitSchema.parse("db_a")).toBe("db_a");
    expect(assessmentCriterionSchema.parse("quantitative")).toBe("quantitative");
    expect(pgrRegistrationTypeSchema.parse("crea")).toBe("crea");
    expect(() => riskAgentTypeSchema.parse("radioactive")).toThrow();
    expect(() => controlLevelSchema.parse("prayer")).toThrow();
  });
});

describe("matriz 5×5 — probabilidade × severidade", () => {
  it("probabilidade/severidade aceitam 1–5 e rejeitam fora da faixa", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      expect(probabilitySchema.parse(n)).toBe(n);
      expect(severitySchema.parse(n)).toBe(n);
    }
    expect(() => probabilitySchema.parse(0)).toThrow();
    expect(() => probabilitySchema.parse(6)).toThrow();
    expect(() => severitySchema.parse(0)).toThrow();
    expect(() => severitySchema.parse(2.5)).toThrow();
  });

  it("grau de incerteza aceita 0–2 e rejeita fora", () => {
    expect(uncertaintyDegreeSchema.parse(0)).toBe(0);
    expect(uncertaintyDegreeSchema.parse(2)).toBe(2);
    expect(() => uncertaintyDegreeSchema.parse(3)).toThrow();
    expect(() => uncertaintyDegreeSchema.parse(-1)).toThrow();
  });

  it("computeRiskLevel = probabilidade × severidade (1–25)", () => {
    expect(computeRiskLevel(1, 1)).toBe(1);
    expect(computeRiskLevel(3, 3)).toBe(9);
    expect(computeRiskLevel(5, 5)).toBe(25);
    expect(computeRiskLevel(2, 4)).toBe(8);
  });

  it("computeRiskLevel rejeita entradas fora de 1–5", () => {
    expect(() => computeRiskLevel(0, 3)).toThrow();
    expect(() => computeRiskLevel(3, 6)).toThrow();
  });
});

describe("rótulos pt-BR", () => {
  it("traduz enums para a UI", () => {
    expect(riskAgentTypeLabel("psychosocial")).toBe("Fatores psicossociais");
    expect(riskAgentTypeLabel("mechanical")).toBe("Mecânico");
    expect(riskAgentTypeLabel("accident")).toBe("Acidentes");
    expect(exposureTimeLabel("lt_1h")).toBe("< 1h/turno");
    expect(controlLevelLabel("ppe")).toBe("IV — EPI");
    expect(uncertaintyDegreeLabel(2)).toBe("Altamente Incerta");
    expect(pgrRegistrationTypeLabel("not_applicable")).toBe("Não aplicável");
  });
});
