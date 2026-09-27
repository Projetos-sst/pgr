import {
  NR09_CONCLUSIONS,
  NR09_ELIGIBLE_AGENTS,
  formatMeasurement,
  hasNr09Measurement,
  isNr09EligibleAgent,
  nr09ConclusionLabel,
  nr09IneligibleReason,
  suggestNr09Conclusion,
} from "@/shared/domains/pgr/nr09";
import { riskAssessmentInputSchema } from "@/shared/domains/pgr/risk-assessment";
import { riskAgentTypeSchema } from "@/shared/domains/pgr/risks";

describe("NR-09 — elegibilidade por agente (#39)", () => {
  it("cobre exatamente físicos, químicos e biológicos", () => {
    expect([...NR09_ELIGIBLE_AGENTS]).toEqual(["physical", "chemical", "biological"]);
  });

  it.each(NR09_ELIGIBLE_AGENTS)("aceita agente %s", (agent) => {
    expect(isNr09EligibleAgent(agent)).toBe(true);
  });

  it.each(["ergonomic", "mechanical", "accident", "psychosocial"] as const)(
    "recusa agente %s",
    (agent) => {
      expect(isNr09EligibleAgent(agent)).toBe(false);
    },
  );

  it("explica a recusa citando os agentes da norma", () => {
    expect(nr09IneligibleReason("ergonomic")).toContain("NR-09");
    expect(nr09IneligibleReason("ergonomic")).toContain("ergonômico");
  });

  it("todo agente do enum tem resposta de elegibilidade", () => {
    for (const agent of riskAgentTypeSchema.options) {
      expect(typeof isNr09EligibleAgent(agent)).toBe("boolean");
    }
  });
});

describe("NR-09 — sugestão de conclusão (auxílio, não veredito)", () => {
  it("sugere 'acima' quando a medição excede o limite", () => {
    expect(
      suggestNr09Conclusion({
        measuredValue: "87.5",
        measuredUnit: "db_a",
        toleranceLimitValue: "85",
      }),
    ).toBe("above_limit");
  });

  it("sugere 'abaixo' quando a medição está sob o limite", () => {
    expect(
      suggestNr09Conclusion({
        measuredValue: "80",
        measuredUnit: "db_a",
        toleranceLimitValue: "85",
      }),
    ).toBe("below_limit");
  });

  it("trata igualdade como 'abaixo' (não excede o limite)", () => {
    expect(
      suggestNr09Conclusion({
        measuredValue: "85",
        measuredUnit: "db_a",
        toleranceLimitValue: "85",
      }),
    ).toBe("below_limit");
  });

  it("não sugere nada sem valor medido", () => {
    expect(
      suggestNr09Conclusion({
        measuredValue: "",
        measuredUnit: "db_a",
        toleranceLimitValue: "85",
      }),
    ).toBeNull();
  });

  it("não sugere nada sem limite numérico", () => {
    expect(
      suggestNr09Conclusion({
        measuredValue: "87",
        measuredUnit: "db_a",
        toleranceLimitValue: null,
      }),
    ).toBeNull();
  });

  it("não sugere nada com unidade qualitativa ou ausente", () => {
    expect(
      suggestNr09Conclusion({
        measuredValue: "87",
        measuredUnit: "qualitative_na",
        toleranceLimitValue: "85",
      }),
    ).toBeNull();
    expect(
      suggestNr09Conclusion({
        measuredValue: "87",
        measuredUnit: null,
        toleranceLimitValue: "85",
      }),
    ).toBeNull();
  });

  it("ignora valores não numéricos em vez de chutar", () => {
    expect(
      suggestNr09Conclusion({
        measuredValue: "acima do limite",
        measuredUnit: "db_a",
        toleranceLimitValue: "85",
      }),
    ).toBeNull();
  });
});

describe("NR-09 — rótulos e formatação", () => {
  it("rotula as três conclusões", () => {
    expect(NR09_CONCLUSIONS).toHaveLength(3);
    for (const conclusion of NR09_CONCLUSIONS) {
      expect(nr09ConclusionLabel(conclusion).length).toBeGreaterThan(3);
    }
  });

  it("formata medição com unidade", () => {
    expect(formatMeasurement("87.5", "db_a")).toBe("87.5 dB(A)");
  });

  it("devolve null quando não há valor medido", () => {
    expect(formatMeasurement(null, "db_a")).toBeNull();
    expect(formatMeasurement("", "db_a")).toBeNull();
  });

  it("omite unidade qualitativa na formatação", () => {
    expect(formatMeasurement("3", "qualitative_na")).toBe("3");
  });
});

describe("NR-09 — presença de medição (ausência nunca vira conformidade)", () => {
  it("avaliação sem nenhum campo não tem medição", () => {
    expect(
      hasNr09Measurement({
        evaluationMethod: null,
        measuredValue: null,
        toleranceLimitValue: null,
        nr09Conclusion: null,
      }),
    ).toBe(false);
  });

  it("basta um campo do bloco para contar como medição registrada", () => {
    expect(hasNr09Measurement({ evaluationMethod: "NHO-01 (ruído)" })).toBe(true);
    expect(hasNr09Measurement({ measuredValue: "80" })).toBe(true);
    expect(hasNr09Measurement({ toleranceLimitValue: "85" })).toBe(true);
    expect(hasNr09Measurement({ nr09Conclusion: "below_limit" })).toBe(true);
  });
});

describe("NR-09 — schema da avaliação", () => {
  const base = {
    criterion: "quantitative" as const,
    probability: "3",
    severity: "3",
    uncertaintyDegree: "0",
    toleranceLimit: "",
    assessedAt: "2026-09-27",
  };

  it("aceita o bloco completo no critério quantitativo", () => {
    const parsed = riskAssessmentInputSchema.parse({
      ...base,
      evaluationMethod: "NHO-01 (ruído)",
      measuredValue: "87.5",
      measuredUnit: "db_a",
      toleranceLimitValue: "85",
      nr09Conclusion: "above_limit",
    });
    expect(parsed.measuredValue).toBe("87.5");
    expect(parsed.nr09Conclusion).toBe("above_limit");
  });

  it("aceita avaliação qualitativa sem o bloco (comportamento antigo intacto)", () => {
    const parsed = riskAssessmentInputSchema.parse({ ...base, criterion: "qualitative" });
    expect(parsed.evaluationMethod).toBeUndefined();
    expect(parsed.nr09Conclusion).toBeUndefined();
  });

  it("recusa o bloco em avaliação qualitativa", () => {
    const result = riskAssessmentInputSchema.safeParse({
      ...base,
      criterion: "qualitative",
      measuredValue: "87.5",
      measuredUnit: "db_a",
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("critério quantitativo");
  });

  it("recusa valor medido sem unidade", () => {
    const result = riskAssessmentInputSchema.safeParse({
      ...base,
      measuredValue: "87.5",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["measuredUnit"]);
  });

  it("recusa valor medido com unidade qualitativa", () => {
    const result = riskAssessmentInputSchema.safeParse({
      ...base,
      measuredValue: "87.5",
      measuredUnit: "qualitative_na",
    });
    expect(result.success).toBe(false);
  });

  it("recusa valor medido não numérico", () => {
    const result = riskAssessmentInputSchema.safeParse({
      ...base,
      measuredValue: "muito alto",
      measuredUnit: "db_a",
    });
    expect(result.success).toBe(false);
  });

  it("recusa conclusão fora do conjunto", () => {
    const result = riskAssessmentInputSchema.safeParse({
      ...base,
      nr09Conclusion: "talvez",
    });
    expect(result.success).toBe(false);
  });

  it("string vazia no bloco equivale a não informado", () => {
    const parsed = riskAssessmentInputSchema.parse({
      ...base,
      criterion: "qualitative",
      evaluationMethod: "",
      measuredValue: "",
      measuredUnit: "",
      toleranceLimitValue: "",
      nr09Conclusion: "",
    });
    expect(parsed.measuredUnit).toBeUndefined();
    expect(parsed.nr09Conclusion).toBeUndefined();
  });
});
