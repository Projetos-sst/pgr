import {
  EPI_RISK_INSTRUCTIONS,
  buildEpiRiskPrompt,
  epiRiskOutputSchema,
} from "@/shared/integrations/agents/epi-risk/prompt";
import type { EpiRiskFillContext } from "@/shared/domains/pgr/ai-epi-risk-fill";

const CTX: EpiRiskFillContext = {
  agentType: "physical",
  hazard: "Ruído",
  description: "Ruído contínuo da prensa",
  sources: "Prensa excêntrica",
  propagation: "Via aérea",
  exposureTime: "habitual",
  catalog: [
    {
      catalogId: "11111111-1111-4111-8111-1111111111a1",
      name: "Protetor auricular plug",
      ca: "12345",
    },
    {
      catalogId: "11111111-1111-4111-8111-1111111111a2",
      name: "Luva nitrílica",
      ca: null,
    },
  ],
  truncated: false,
  linkedCatalogIds: ["11111111-1111-4111-8111-1111111111a9"],
};

describe("buildEpiRiskPrompt", () => {
  it("inclui o risco e cada EPI do catálogo com id, nome e CA", () => {
    const p = buildEpiRiskPrompt(CTX);
    expect(p).toContain("Ruído contínuo da prensa");
    expect(p).toContain("Prensa excêntrica");
    expect(p).toContain("Via aérea");
    expect(p).toContain("11111111-1111-4111-8111-1111111111a1");
    expect(p).toContain("Protetor auricular plug");
    expect(p).toContain("CA 12345");
    expect(p).toContain("Luva nitrílica");
  });

  it("não manda dado de pessoa nem os vínculos já existentes", () => {
    const p = buildEpiRiskPrompt(CTX);
    expect(p).not.toMatch(/CPF|nome do trabalhador|funcionário/i);
    expect(p).not.toContain("1111111111a9");
  });

  it("omite linha de campo ausente", () => {
    const p = buildEpiRiskPrompt({ ...CTX, hazard: null, propagation: null });
    expect(p).not.toContain("Perigo");
    expect(p).not.toContain("Propagação");
  });
});

describe("EPI_RISK_INSTRUCTIONS", () => {
  it("manda escolher só EPIs da lista, pelo id exato, e nunca inventar CA", () => {
    expect(EPI_RISK_INSTRUCTIONS).toMatch(/SOMENTE.*lista/);
    expect(EPI_RISK_INSTRUCTIONS).toMatch(/id exato/);
    expect(EPI_RISK_INSTRUCTIONS).toMatch(
      /neutralizes, does_not_neutralize, not_applicable/,
    );
    expect(EPI_RISK_INSTRUCTIONS).not.toMatch(/OpenRouter|GPT|Claude|Gemini/);
  });
});

describe("epiRiskOutputSchema", () => {
  it("aceita a resposta em lista de vínculos", () => {
    expect(
      epiRiskOutputSchema.safeParse({
        links: [{ catalogId: "x", neutralization: "Sim", rationale: "Atenua o ruído" }],
      }).success,
    ).toBe(true);
  });
});
