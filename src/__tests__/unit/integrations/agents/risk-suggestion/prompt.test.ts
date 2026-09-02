import {
  SUGGESTION_TOOL_NAME,
  buildRiskSuggestionPrompt,
  buildSuggestionTool,
  extractSuggestions,
} from "@/shared/integrations/agents/risk-suggestion/prompt";
import type { ToolCall } from "@/shared/integrations/agents/tool-call";
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

/** Tool call no formato da OpenRouter/OpenAI: argumentos são **string JSON**. */
function toolCall(name: string, args: unknown): ToolCall {
  return { type: "function", function: { name, arguments: JSON.stringify(args) } };
}

describe("extractSuggestions", () => {
  it("extrai do tool call correto (ignora tool calls alheios)", () => {
    const out = extractSuggestions([
      toolCall("outra_tool", { risks: [] }),
      toolCall(SUGGESTION_TOOL_NAME, {
        risks: [{ agentType: "physical", description: "Ruído" }],
      }),
    ]);
    expect(out).toHaveLength(1);
  });

  it("sem tool call → lista vazia", () => {
    expect(extractSuggestions([])).toEqual([]);
  });

  it("ignora tool call de outro nome", () => {
    expect(
      extractSuggestions([
        toolCall("outra_tool", {
          risks: [{ agentType: "physical", description: "x" }],
        }),
      ]),
    ).toEqual([]);
  });

  it("argumentos com JSON inválido → lista vazia (não estoura)", () => {
    expect(
      extractSuggestions([
        { type: "function", function: { name: SUGGESTION_TOOL_NAME, arguments: "{" } },
      ]),
    ).toEqual([]);
  });
});

describe("buildSuggestionTool", () => {
  it("expõe o nome e o enum completo de grupos de agente", () => {
    const tool = buildSuggestionTool();
    expect(tool.type).toBe("function");
    expect(tool.function.name).toBe(SUGGESTION_TOOL_NAME);
    const json = JSON.stringify(tool);
    expect(json).toContain("physical");
    expect(json).toContain("psychosocial");
  });
});
