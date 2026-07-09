import {
  riskAssessmentInputSchema,
  deriveAssessmentResult,
  computeRiskLevel,
  type RiskAssessmentInput,
} from "@/shared/domains/pgr/risk-assessment";
import { defaultRiskMethodology } from "@/shared/domains/pgr/methodology-presets";

const BANDS = defaultRiskMethodology().classificationBands;

function input(overrides: Partial<Record<keyof RiskAssessmentInput, unknown>> = {}) {
  return {
    criterion: "quantitative",
    probability: 3,
    severity: 3,
    uncertaintyDegree: 0,
    assessedAt: "2026-07-08",
    ...overrides,
  } as RiskAssessmentInput;
}

describe("riskAssessmentInputSchema", () => {
  it("aceita entrada válida e coage strings numéricas", () => {
    const parsed = riskAssessmentInputSchema.parse(
      input({ probability: "4", severity: "2", uncertaintyDegree: "1" }),
    );
    expect(parsed.probability).toBe(4);
    expect(parsed.severity).toBe(2);
    expect(parsed.uncertaintyDegree).toBe(1);
  });

  it("uncertaintyDegree default 0 quando omitido", () => {
    const { uncertaintyDegree: _u, ...rest } = input();
    const parsed = riskAssessmentInputSchema.parse(rest as RiskAssessmentInput);
    expect(parsed.uncertaintyDegree).toBe(0);
  });

  it.each([0, 6])("probability fora de 1–5 (%s) é inválida", (p) => {
    expect(riskAssessmentInputSchema.safeParse(input({ probability: p })).success).toBe(
      false,
    );
  });

  it.each([1, 3, 5])("probability %s é válida", (p) => {
    expect(riskAssessmentInputSchema.safeParse(input({ probability: p })).success).toBe(
      true,
    );
  });

  it.each([0, 6])("severity fora de 1–5 (%s) é inválida", (s) => {
    expect(riskAssessmentInputSchema.safeParse(input({ severity: s })).success).toBe(
      false,
    );
  });

  it.each([-1, 3])("uncertaintyDegree fora de 0–2 (%s) é inválido", (u) => {
    expect(
      riskAssessmentInputSchema.safeParse(input({ uncertaintyDegree: u })).success,
    ).toBe(false);
  });

  it("criterion inválido é rejeitado", () => {
    expect(
      riskAssessmentInputSchema.safeParse(input({ criterion: "invalid" })).success,
    ).toBe(false);
  });

  it("assessedAt é obrigatória e valida o calendário", () => {
    const { assessedAt: _a, ...rest } = input();
    expect(riskAssessmentInputSchema.safeParse(rest as RiskAssessmentInput).success).toBe(
      false,
    );
    expect(
      riskAssessmentInputSchema.safeParse(input({ assessedAt: "2026-13-45" })).success,
    ).toBe(false);
    expect(
      riskAssessmentInputSchema.safeParse(input({ assessedAt: "2026-07-08" })).success,
    ).toBe(true);
  });

  it("riskLevel e result não fazem parte do input validado", () => {
    const parsed = riskAssessmentInputSchema.parse(
      input({ riskLevel: 999, result: "trivial" } as never),
    );
    expect("riskLevel" in parsed).toBe(false);
    expect("result" in parsed).toBe(false);
  });
});

describe("computeRiskLevel", () => {
  it("multiplica probabilidade × severidade", () => {
    expect(computeRiskLevel(3, 3)).toBe(9);
    expect(computeRiskLevel(5, 5)).toBe(25);
    expect(computeRiskLevel(1, 1)).toBe(1);
  });
});

describe("deriveAssessmentResult (metodologia padrão)", () => {
  it("nível 1 → trivial; 9 → moderate; 25 → intolerable", () => {
    expect(deriveAssessmentResult({ probability: 1, severity: 1 }, BANDS)).toEqual({
      riskLevel: 1,
      result: "trivial",
    });
    expect(deriveAssessmentResult({ probability: 3, severity: 3 }, BANDS)).toEqual({
      riskLevel: 9,
      result: "moderate",
    });
    expect(deriveAssessmentResult({ probability: 5, severity: 5 }, BANDS)).toEqual({
      riskLevel: 25,
      result: "intolerable",
    });
  });
});
