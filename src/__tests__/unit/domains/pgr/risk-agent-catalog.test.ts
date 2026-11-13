import {
  RISK_AGENT_CATALOG,
  catalogAgentNames,
  isUsualUnit,
  unitCatalogNotice,
  unitOptionsFor,
  usualUnits,
} from "@/shared/domains/pgr/risk-agent-catalog";
import {
  measurementUnitSchema,
  riskAgentTypeSchema,
  type MeasurementUnit,
  type RiskAgentType,
} from "@/shared/domains/pgr/risks";

const CATEGORIES = riskAgentTypeSchema.options;

describe("catálogo de agentes por categoria", () => {
  it("toda categoria tem agentes de exemplo com nome único, unidade do enum e fonte", () => {
    for (const category of CATEGORIES) {
      const agents = RISK_AGENT_CATALOG[category];
      expect(agents.length).toBeGreaterThan(0);
      expect(new Set(agents.map((agent) => agent.name)).size).toBe(agents.length);
      for (const agent of agents) {
        expect(agent.source.trim()).not.toBe("");
        expect(agent.units.length).toBeGreaterThan(0);
        for (const unit of agent.units) {
          expect(measurementUnitSchema.options).toContain(unit);
        }
      }
    }
  });

  it("sugere os agentes da categoria escolhida e nenhum sem categoria", () => {
    expect(catalogAgentNames("physical")).toContain("Ruído contínuo ou intermitente");
    expect(catalogAgentNames("chemical")).not.toContain("Ruído contínuo ou intermitente");
    expect(catalogAgentNames("")).toEqual([]);
    expect(catalogAgentNames("radioactive")).toEqual([]);
  });
});

describe("unidades usuais por categoria e por agente", () => {
  it("toda categoria aceita a marca qualitativa, na ordem do enum", () => {
    for (const category of CATEGORIES) {
      const units = usualUnits(category);
      expect(units[0]).toBe("qualitative_na");
      expect(units).toEqual(
        measurementUnitSchema.options.filter((unit) => units.includes(unit)),
      );
    }
  });

  it("categorias sem medição usual só têm a marca qualitativa", () => {
    for (const category of ["biological", "mechanical", "accident", "psychosocial"]) {
      expect(usualUnits(category)).toEqual(["qualitative_na"]);
    }
  });

  it.each<[RiskAgentType, string | null, MeasurementUnit]>([
    ["physical", "Ruído contínuo ou intermitente", "db_a"],
    ["physical", "ruido continuo ou intermitente", "db_a"],
    ["physical", "Ruído de impacto", "db_c"],
    ["physical", "Vibração de mãos e braços", "m_s2"],
    ["physical", "Calor", "celsius"],
    ["physical", "Agente fora da lista", "db_c"],
    ["chemical", "Gases e vapores", "ppm"],
    ["chemical", "Gases e vapores", "mg_m3"],
    ["chemical", "Fibras de asbesto", "f_cm3"],
    ["chemical", null, "percent"],
    ["ergonomic", "Iluminação inadequada", "lux"],
    ["biological", "Vírus, bactérias e fungos", "qualitative_na"],
  ])("válido: %s / %s com %s", (category, hazard, unit) => {
    expect(isUsualUnit({ agentType: category, hazard, unit })).toBe(true);
  });

  it.each<[RiskAgentType, string | null, MeasurementUnit]>([
    ["physical", "Ruído contínuo ou intermitente", "db_c"],
    ["physical", "Ruído contínuo ou intermitente", "ppm"],
    ["physical", null, "mg_m3"],
    ["chemical", "Gases e vapores", "f_cm3"],
    ["chemical", null, "db_a"],
    ["biological", null, "ppm"],
    ["ergonomic", "Postura inadequada", "lux"],
    ["accident", null, "celsius"],
    ["psychosocial", null, "percent"],
  ])("fora do usual: %s / %s com %s", (category, hazard, unit) => {
    expect(isUsualUnit({ agentType: category, hazard, unit })).toBe(false);
  });

  it("valor antigo fora do catálogo vira aviso legível, nunca erro", () => {
    expect(
      unitCatalogNotice({ agentType: "chemical", hazard: "Tinta", unit: "lux" }),
    ).toBe(
      "A unidade lux não está entre as usuais do grupo Químico (Qualitativo / Não aplicável, ppm, mg/m³, f/cm³, %). O registro continua válido; confira a unidade.",
    );
    expect(
      unitCatalogNotice({ agentType: "chemical", hazard: "Tinta", unit: "ppm" }),
    ).toBeNull();
    expect(
      unitCatalogNotice({ agentType: "chemical", hazard: "Tinta", unit: null }),
    ).toBeNull();
  });
});

describe("opções de unidade do formulário", () => {
  it("lista as usuais primeiro e marca as demais, sem esconder nenhuma", () => {
    const options = unitOptionsFor("physical");
    expect(options.map((option) => option.value)).toEqual([
      "qualitative_na",
      "db_a",
      "db_c",
      "m_s2",
      "celsius",
      "ppm",
      "mg_m3",
      "f_cm3",
      "percent",
      "lux",
    ]);
    expect(options.find((option) => option.value === "db_a")?.label).toBe("dB(A)");
    expect(options.find((option) => option.value === "ppm")?.label).toBe(
      "ppm (fora do usual do grupo)",
    );
  });

  it("sem categoria escolhida mostra todas as unidades sem marca", () => {
    expect(unitOptionsFor("").map((option) => option.label)).toEqual([
      "Qualitativo / Não aplicável",
      "dB(A)",
      "dB(C)",
      "m/s²",
      "ppm",
      "mg/m³",
      "f/cm³",
      "°C",
      "%",
      "lux",
    ]);
  });
});
