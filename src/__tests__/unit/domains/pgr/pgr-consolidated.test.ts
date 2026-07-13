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
    riskLevel: overrides.riskLevel ?? null,
    result: overrides.result ?? null,
    measures: overrides.measures ?? [],
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
