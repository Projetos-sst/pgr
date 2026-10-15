import {
  CONTROL_MEASURE_INSTRUCTIONS,
  buildControlMeasurePrompt,
} from "@/shared/integrations/agents/control-measure/prompt";
import type { RiskControlContext } from "@/shared/domains/pgr/ai-control-measure-suggestion";

const CTX: RiskControlContext = {
  agentType: "physical",
  hazard: "Ruído",
  description: "Exposição a ruído contínuo acima de 85 dB(A)",
  sources: "Esmerilhadeira",
  possibleInjuries: "Perda auditiva",
  gesName: "Setor de Solda",
  processDescription: "Soldagem MIG/MAG",
  environment: "Galpão industrial",
  roleTitles: ["Soldador"],
  classification: "substantial",
  riskLevel: 15,
  existingLevels: ["ppe"],
};

describe("buildControlMeasurePrompt", () => {
  it("inclui o risco, o ambiente e os títulos de função", () => {
    const p = buildControlMeasurePrompt(CTX);
    expect(p).toContain("Exposição a ruído contínuo acima de 85 dB(A)");
    expect(p).toContain("Galpão industrial");
    expect(p).toContain("Soldador");
  });

  /**
   * A orientação normativa da classificação entra porque é a regra que a própria
   * plataforma aplica — a medida proposta tem de ser coerente com o que já se exige.
   */
  it("leva a classificação vigente com a orientação normativa", () => {
    const p = buildControlMeasurePrompt(CTX);
    expect(p).toContain("Substancial");
    expect(p).toContain("nível 15");
    expect(p).toMatch(/Plano de ação prioritário/);
  });

  it("avisa quais níveis já existem, para não repetir", () => {
    expect(buildControlMeasurePrompt(CTX)).toMatch(/Níveis JÁ cadastrados[\s\S]*ppe/);
  });

  it("omite linha de campo ausente em vez de mandar rótulo vazio", () => {
    const p = buildControlMeasurePrompt({
      ...CTX,
      hazard: null,
      environment: null,
      classification: null,
      existingLevels: [],
    });
    expect(p).not.toContain("Perigo:");
    expect(p).not.toContain("Ambiente:");
    expect(p).not.toContain("Classificação vigente:");
    expect(p).not.toContain("Níveis JÁ cadastrados");
  });
});

describe("CONTROL_MEASURE_INSTRUCTIONS", () => {
  it("ancora na hierarquia da NR-01 e põe EPI por último", () => {
    expect(CONTROL_MEASURE_INSTRUCTIONS).toContain("NR-01");
    expect(CONTROL_MEASURE_INSTRUCTIONS).toMatch(/EPI é o último recurso/);
  });

  it("proíbe definir responsável e prazo", () => {
    expect(CONTROL_MEASURE_INSTRUCTIONS).toMatch(/Não defina responsável nem prazo/);
  });
});
