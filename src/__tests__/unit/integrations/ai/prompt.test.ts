import {
  SUGGESTION_TOOL_NAME,
  buildRiskSuggestionPrompt,
  buildSuggestionTool,
  extractSuggestionsFromContent,
} from "@/shared/integrations/ai/prompt";
import type { GesRiskContext } from "@/shared/domains/pgr/ai-risk-suggestion";

const CTX: GesRiskContext = {
  name: "Marcenaria",
  processDescription: "Corte e lixamento de peças de madeira",
  constructionType: "Alvenaria",
  ceilingHeight: "4.5",
  floor: "Concreto",
  roof: "Telha metálica",
  lighting: "Natural + artificial",
  ventilation: "Exaustão local",
  otherCharacteristics: null,
  roles: [{ title: "Marceneiro", workerCount: 3 }],
};

describe("buildRiskSuggestionPrompt", () => {
  it("inclui os campos do GES e os títulos das funções", () => {
    const { system, user } = buildRiskSuggestionPrompt(CTX);
    expect(user).toContain("Marcenaria");
    expect(user).toContain("Corte e lixamento de peças de madeira");
    expect(user).toContain("Marceneiro");
    expect(user).toContain("Exaustão local");
    expect(system).toContain("NR-01");
  });

  it("omite as linhas de campos ausentes (null)", () => {
    const { user } = buildRiskSuggestionPrompt(CTX);
    expect(user).not.toContain("Outras características");
  });

  it("não introduz PII (o contexto não tem funcionários/CPF)", () => {
    const { user } = buildRiskSuggestionPrompt(CTX);
    expect(user).not.toMatch(/CPF|funcion[aá]rio/i);
  });

  it("sem funções → 'não informadas'", () => {
    const { user } = buildRiskSuggestionPrompt({ ...CTX, roles: [] });
    expect(user).toContain("não informadas");
  });
});

describe("extractSuggestionsFromContent", () => {
  it("extrai do bloco tool_use correto (ignora blocos de texto)", () => {
    const out = extractSuggestionsFromContent([
      { type: "text" },
      {
        type: "tool_use",
        name: SUGGESTION_TOOL_NAME,
        input: { risks: [{ agentType: "physical", description: "Ruído" }] },
      },
    ]);
    expect(out).toHaveLength(1);
  });

  it("sem bloco tool_use → lista vazia", () => {
    expect(extractSuggestionsFromContent([{ type: "text" }])).toEqual([]);
  });

  it("ignora tool_use de outro nome", () => {
    expect(
      extractSuggestionsFromContent([
        {
          type: "tool_use",
          name: "outra_tool",
          input: { risks: [{ agentType: "physical", description: "x" }] },
        },
      ]),
    ).toEqual([]);
  });
});

describe("buildSuggestionTool", () => {
  it("expõe o nome e o enum completo de grupos de agente", () => {
    const tool = buildSuggestionTool();
    expect(tool.name).toBe(SUGGESTION_TOOL_NAME);
    const json = JSON.stringify(tool);
    expect(json).toContain("physical");
    expect(json).toContain("psychosocial");
  });
});
