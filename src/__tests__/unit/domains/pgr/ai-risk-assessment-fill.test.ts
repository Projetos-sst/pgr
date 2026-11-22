import {
  AI_RISK_ASSESSMENT_FILL_KIND,
  filledAssessmentFields,
  fitAssessmentToRisk,
  parseModelRiskAssessment,
  type FilledRiskAssessment,
} from "@/shared/domains/pgr/ai-risk-assessment-fill";

const NO_MEASUREMENT = { hasMeasuredValue: false, nr09Eligible: true };
const MEASURED = { hasMeasuredValue: true, nr09Eligible: true };

describe("AI_RISK_ASSESSMENT_FILL_KIND", () => {
  it("é o kind de uso de IA da avaliação de risco", () => {
    expect(AI_RISK_ASSESSMENT_FILL_KIND).toBe("risk_assessment_fill");
  });
});

describe("parseModelRiskAssessment", () => {
  it("lê critério, probabilidade, severidade, método e justificativa", () => {
    expect(
      parseModelRiskAssessment({
        criterion: "quantitativo",
        probability: "4",
        severity: 3,
        evaluationMethod: "NHO-01",
        justification: "Exposição diária ao ruído da prensa.",
      }),
    ).toEqual({
      criterion: "quantitative",
      probability: 4,
      severity: 3,
      evaluationMethod: "NHO-01",
      justification: "Exposição diária ao ruído da prensa.",
    });
  });

  it("limita probabilidade e severidade a 1–5 e arredonda", () => {
    const parsed = parseModelRiskAssessment({
      criterion: "qualitative",
      probability: 9,
      severity: 0.2,
    });
    expect(parsed).toMatchObject({ probability: 5, severity: 1 });
  });

  it("critério desconhecido vira qualitativo e texto vazio vira null", () => {
    expect(
      parseModelRiskAssessment({
        criterion: "misto",
        probability: 2,
        severity: 2,
        evaluationMethod: " ",
      }),
    ).toEqual({
      criterion: "qualitative",
      probability: 2,
      severity: 2,
      evaluationMethod: null,
      justification: null,
    });
  });

  it("sem probabilidade ou severidade numérica devolve null", () => {
    expect(
      parseModelRiskAssessment({ criterion: "qualitative", probability: "alta" }),
    ).toBe(null);
    expect(parseModelRiskAssessment("texto solto")).toBe(null);
  });

  it("descarta valor medido, limite de tolerância, incerteza e conclusão NR-09 inventados", () => {
    const parsed = parseModelRiskAssessment({
      criterion: "quantitative",
      probability: 3,
      severity: 3,
      measuredValue: "92",
      measuredUnit: "db_a",
      toleranceLimit: "85 dB(A)",
      toleranceLimitValue: "85",
      uncertaintyDegree: 2,
      nr09Conclusion: "above_limit",
    });
    expect(Object.keys(parsed ?? {}).sort()).toEqual([
      "criterion",
      "evaluationMethod",
      "justification",
      "probability",
      "severity",
    ]);
  });
});

describe("fitAssessmentToRisk", () => {
  const quantitative: FilledRiskAssessment = {
    criterion: "quantitative",
    probability: 3,
    severity: 4,
    evaluationMethod: "NHO-01",
    justification: "Ruído medido acima do nível de ação.",
  };

  it("sem medição registrada no risco força o critério qualitativo e tira o método", () => {
    expect(fitAssessmentToRisk(quantitative, NO_MEASUREMENT)).toEqual({
      ...quantitative,
      criterion: "qualitative",
      evaluationMethod: null,
    });
  });

  it("com medição registrada mantém o quantitativo e o método", () => {
    expect(fitAssessmentToRisk(quantitative, MEASURED)).toEqual(quantitative);
  });

  it("agente fora da NR-09 não leva método de avaliação", () => {
    expect(
      fitAssessmentToRisk(quantitative, { hasMeasuredValue: true, nr09Eligible: false }),
    ).toMatchObject({ criterion: "quantitative", evaluationMethod: null });
  });

  it("critério qualitativo nunca leva método", () => {
    expect(
      fitAssessmentToRisk({ ...quantitative, criterion: "qualitative" }, MEASURED),
    ).toMatchObject({ evaluationMethod: null });
  });
});

describe("filledAssessmentFields", () => {
  it("lista os campos que a IA preencheu, com o método só quando veio", () => {
    expect(
      filledAssessmentFields({
        criterion: "qualitative",
        probability: 2,
        severity: 2,
        evaluationMethod: null,
        justification: null,
      }),
    ).toEqual(["criterion", "probability", "severity"]);
    expect(
      filledAssessmentFields({
        criterion: "quantitative",
        probability: 2,
        severity: 2,
        evaluationMethod: "NHO-01",
        justification: null,
      }),
    ).toEqual(["criterion", "probability", "severity", "evaluationMethod"]);
  });
});
