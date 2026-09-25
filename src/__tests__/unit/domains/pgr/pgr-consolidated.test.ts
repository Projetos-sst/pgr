import {
  sortConsolidatedRisks,
  deriveMeasureState,
  type ConsolidatedRisk,
} from "@/shared/domains/pgr/pgr-consolidated";

function risk(overrides: Partial<ConsolidatedRisk> = {}): ConsolidatedRisk {
  return {
    id: overrides.id ?? "r",
    agentType: "physical",
    description: overrides.description ?? "desc",
    hazard: null,
    sources: null,
    propagation: null,
    exposureTime: null,
    possibleInjuries: null,
    noxiousAgentCode: null,
    measurementUnit: null,
    concentrationIntensity: null,
    riskLevel: overrides.riskLevel ?? null,
    result: overrides.result ?? null,
    assessment: null,
    measures: overrides.measures ?? [],
    planCoverage: overrides.planCoverage ?? "not_assessed",
    epis: overrides.epis ?? [],
    ...overrides,
  };
}

describe("sortConsolidatedRisks", () => {
  it("ordena por risk_level desc (mais graves primeiro)", () => {
    const out = sortConsolidatedRisks([
      risk({ id: "a", riskLevel: 4 }),
      risk({ id: "b", riskLevel: 20 }),
      risk({ id: "c", riskLevel: 9 }),
    ]);
    expect(out.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("coloca riscos sem avaliação (riskLevel null) por último", () => {
    const out = sortConsolidatedRisks([
      risk({ id: "semAval", riskLevel: null, description: "A" }),
      risk({ id: "comAval", riskLevel: 5, description: "B" }),
    ]);
    expect(out.map((r) => r.id)).toEqual(["comAval", "semAval"]);
  });

  it("desempate estável por descrição quando o nível é igual", () => {
    const out = sortConsolidatedRisks([
      risk({ id: "z", riskLevel: 10, description: "Zebra" }),
      risk({ id: "a", riskLevel: 10, description: "Alfa" }),
    ]);
    expect(out.map((r) => r.id)).toEqual(["a", "z"]);
  });

  it("vários sem avaliação ordenados entre si por descrição, sempre após os avaliados", () => {
    const out = sortConsolidatedRisks([
      risk({ id: "n2", riskLevel: null, description: "Beta" }),
      risk({ id: "n1", riskLevel: null, description: "Alfa" }),
      risk({ id: "y", riskLevel: 3, description: "X" }),
    ]);
    expect(out.map((r) => r.id)).toEqual(["y", "n1", "n2"]);
  });

  it("lista vazia → vazia (fallback PGR/GES sem riscos)", () => {
    expect(sortConsolidatedRisks([])).toEqual([]);
  });

  it("não muta o array de entrada", () => {
    const input = [risk({ id: "a", riskLevel: 1 }), risk({ id: "b", riskLevel: 2 })];
    const copy = [...input];
    sortConsolidatedRisks(input);
    expect(input.map((r) => r.id)).toEqual(copy.map((r) => r.id));
  });

  it("preserva os EPIs e o 5W2H de cada risco ao ordenar (fatia 022)", () => {
    const epi = {
      id: "e1",
      catalogId: "c1",
      name: "Capacete",
      ca: "CA-123",
      neutralization: "neutralizes" as const,
    };
    const measure = {
      id: "m1",
      controlLevel: "ppe" as const,
      applicable: true,
      justification: "j",
      monitoring: "mon",
      actionWhat: "o quê",
      actionHow: "como",
      actionTracking: "acomp",
      actionMeasurement: "medição",
      actionResponsible: "resp",
      actionDeadline: "2026-12-31",
      status: "introduced" as const,
      state: "planned" as const,
    };
    const out = sortConsolidatedRisks([
      risk({ id: "a", riskLevel: 5, epis: [epi], measures: [measure] }),
    ]);
    expect(out[0].epis).toEqual([epi]);
    expect(out[0].measures[0].actionWhat).toBe("o quê");
    expect(out[0].measures[0].actionMeasurement).toBe("medição");
  });
});

describe("estado derivado das medidas (reuso da Feature 018, sem status persistido)", () => {
  const TODAY = "2026-07-12";
  it("without_plan / planned / overdue", () => {
    expect(deriveMeasureState({ applicable: false, actionDeadline: null }, TODAY)).toBe(
      "without_plan",
    );
    expect(
      deriveMeasureState({ applicable: true, actionDeadline: "2026-12-31" }, TODAY),
    ).toBe("planned");
    expect(
      deriveMeasureState({ applicable: true, actionDeadline: "2026-07-01" }, TODAY),
    ).toBe("overdue");
  });
});
