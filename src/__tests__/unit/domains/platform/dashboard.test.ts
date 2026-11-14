import {
  CONTROL_LEVELS,
  RISK_AGENT_TYPES,
  fillRisksByAgentType,
  zeroFillCounts,
} from "@/shared/domains/platform/dashboard";

describe("zeroFillCounts", () => {
  it("preenche todas as chaves na ordem, zerando as ausentes", () => {
    const out = zeroFillCounts(["a", "b", "c"] as const, (k) => k.toUpperCase(), [
      { key: "b", count: 5 },
    ]);
    expect(out).toEqual([
      { key: "a", label: "A", count: 0 },
      { key: "b", label: "B", count: 5 },
      { key: "c", label: "C", count: 0 },
    ]);
  });

  it("ignora chaves desconhecidas vindas da query", () => {
    const out = zeroFillCounts(["a"] as const, (k) => k, [
      { key: "a", count: 2 },
      { key: "zzz", count: 99 },
    ]);
    expect(out).toEqual([{ key: "a", label: "a", count: 2 }]);
  });
});

describe("fillRisksByAgentType", () => {
  it("sempre retorna os 7 grupos de agente (paridade ePGR), com rótulos", () => {
    const out = fillRisksByAgentType([{ key: "physical", count: 3 }]);
    expect(out).toHaveLength(RISK_AGENT_TYPES.length);
    const physical = out.find((r) => r.key === "physical");
    expect(physical?.count).toBe(3);
    expect(physical?.label).toBeTruthy();
    expect(out.every((r) => typeof r.label === "string" && r.label.length > 0)).toBe(
      true,
    );
  });
});

describe("CONTROL_LEVELS", () => {
  it("expõe os 5 níveis da hierarquia de controle", () => {
    expect(CONTROL_LEVELS).toEqual([
      "elimination",
      "substitution",
      "collective_protection",
      "administrative",
      "ppe",
    ]);
  });
});
