import {
  RISK_ASSESSMENT_INSTRUCTIONS,
  buildRiskAssessmentPrompt,
  riskAssessmentOutputSchema,
} from "@/shared/integrations/agents/risk-assessment/prompt";
import type { RiskAssessmentFillContext } from "@/shared/domains/pgr/ai-risk-assessment-fill";

const CTX: RiskAssessmentFillContext = {
  agentType: "physical",
  hazard: "Ruído",
  description: "Ruído contínuo da prensa",
  sources: "Prensa excêntrica",
  propagation: "Via aérea",
  exposureTime: "habitual",
  possibleInjuries: "Perda auditiva",
  hasMeasuredValue: false,
  nr09Eligible: true,
};

describe("buildRiskAssessmentPrompt", () => {
  it("inclui a caracterização do risco", () => {
    const p = buildRiskAssessmentPrompt(CTX);
    expect(p).toContain("Ruído contínuo da prensa");
    expect(p).toContain("Prensa excêntrica");
    expect(p).toContain("Perda auditiva");
    expect(p).toContain("habitual");
  });

  it("diz se há medição registrada sem mandar valor nenhum", () => {
    expect(buildRiskAssessmentPrompt(CTX)).toMatch(/Medição registrada.*não/);
    expect(buildRiskAssessmentPrompt({ ...CTX, hasMeasuredValue: true })).toMatch(
      /Medição registrada.*sim/,
    );
  });

  it("não manda dado de pessoa", () => {
    expect(buildRiskAssessmentPrompt(CTX)).not.toMatch(
      /CPF|nome do trabalhador|funcionário|matrícula/i,
    );
  });

  it("omite linha de campo ausente", () => {
    const p = buildRiskAssessmentPrompt({ ...CTX, hazard: null, propagation: null });
    expect(p).not.toContain("Perigo");
    expect(p).not.toContain("Propagação");
  });
});

describe("RISK_ASSESSMENT_INSTRUCTIONS", () => {
  it("exige critério qualitativo sem medição e proíbe inventar medição e conclusão", () => {
    expect(RISK_ASSESSMENT_INSTRUCTIONS).toMatch(/qualitative/);
    expect(RISK_ASSESSMENT_INSTRUCTIONS).toMatch(/Nunca invente valor medido/);
    expect(RISK_ASSESSMENT_INSTRUCTIONS).toMatch(/limite de tolerância/);
    expect(RISK_ASSESSMENT_INSTRUCTIONS).toMatch(/conclusão da NR-09/);
    expect(RISK_ASSESSMENT_INSTRUCTIONS).not.toMatch(/OpenRouter|GPT|Claude|Gemini/);
  });
});

describe("riskAssessmentOutputSchema", () => {
  it("aceita números e textos na resposta", () => {
    expect(
      riskAssessmentOutputSchema.safeParse({
        criterion: "qualitative",
        probability: 3,
        severity: "4",
        justification: "Exposição habitual",
      }).success,
    ).toBe(true);
  });

  it("não pede valor medido, limite, incerteza nem conclusão", () => {
    expect(Object.keys(riskAssessmentOutputSchema.shape).sort()).toEqual([
      "criterion",
      "evaluationMethod",
      "justification",
      "probability",
      "severity",
    ]);
  });
});
