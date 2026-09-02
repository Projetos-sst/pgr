import {
  MAX_SUGGESTIONS,
  parseModelSuggestions,
  suggestedRiskSchema,
  toRiskValuesFromSuggestion,
} from "@/shared/domains/pgr/ai-risk-suggestion";

const GES_ID = "11111111-1111-1111-1111-111111111111";

describe("suggestedRiskSchema", () => {
  it("aceita risco válido com campos opcionais ausentes", () => {
    const r = suggestedRiskSchema.parse({ agentType: "physical", description: "Ruído" });
    expect(r.agentType).toBe("physical");
    expect(r.hazard).toBeUndefined();
    expect(r.sources).toBeUndefined();
  });

  it("rejeita agentType fora do enum", () => {
    expect(
      suggestedRiskSchema.safeParse({ agentType: "cosmic", description: "x" }).success,
    ).toBe(false);
  });

  it("rejeita description vazia/em branco", () => {
    expect(
      suggestedRiskSchema.safeParse({ agentType: "physical", description: "  " }).success,
    ).toBe(false);
  });

  it("normaliza hazard/sources null|'' → undefined (robusto à saída do LLM)", () => {
    const r = suggestedRiskSchema.parse({
      agentType: "chemical",
      description: "Poeira",
      hazard: null,
      sources: "",
    });
    expect(r.hazard).toBeUndefined();
    expect(r.sources).toBeUndefined();
  });
});

describe("parseModelSuggestions", () => {
  it("valida item-a-item e descarta inválidos (não o lote)", () => {
    const out = parseModelSuggestions([
      { agentType: "physical", description: "Ruído" },
      { agentType: "invalid", description: "x" },
      { agentType: "ergonomic", description: "" },
      { agentType: "chemical", description: "Poeira", sources: "Esmeril" },
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.agentType)).toEqual(["physical", "chemical"]);
  });

  it("aceita o wrapper { risks: [...] }", () => {
    expect(
      parseModelSuggestions({
        risks: [{ agentType: "biological", description: "Fungos" }],
      }),
    ).toHaveLength(1);
  });

  it("entrada nula/estranha → lista vazia (resultado válido)", () => {
    expect(parseModelSuggestions(null)).toEqual([]);
    expect(parseModelSuggestions({ foo: 1 })).toEqual([]);
    expect(parseModelSuggestions("nope")).toEqual([]);
  });

  it("respeita o teto MAX_SUGGESTIONS", () => {
    const many = Array.from({ length: MAX_SUGGESTIONS + 5 }, () => ({
      agentType: "physical",
      description: "Ruído",
    }));
    expect(parseModelSuggestions(many)).toHaveLength(MAX_SUGGESTIONS);
  });
});

describe("toRiskValuesFromSuggestion", () => {
  it("mapeia sugestão → rascunho (só campos da IA + gesId; aprofundamento vazio)", () => {
    const v = toRiskValuesFromSuggestion(GES_ID, {
      agentType: "physical",
      description: "Ruído",
      hazard: "Nível > 85 dB(A)",
      sources: "Esmerilhadeira",
    });
    expect(v.gesId).toBe(GES_ID);
    expect(v.agentType).toBe("physical");
    expect(v.description).toBe("Ruído");
    expect(v.hazard).toBe("Nível > 85 dB(A)");
    expect(v.sources).toBe("Esmerilhadeira");
    // Campos eSocial/avaliação ficam vazios — é rascunho.
    expect(v.exposureTime).toBeUndefined();
    expect(v.measurementUnit).toBeUndefined();
    expect(v.concentrationIntensity).toBeUndefined();
  });

  it("gesId inválido → erro (vira VALIDATION na ação)", () => {
    expect(() =>
      toRiskValuesFromSuggestion("not-a-uuid", {
        agentType: "physical",
        description: "Ruído",
      }),
    ).toThrow();
  });
});

/**
 * O prompt pede o grupo do agente em inglês (o enum do banco), mas a conversa é em
 * português e o modelo às vezes responde no idioma dela. Sem normalizar, o Zod reprovava
 * **item a item** e uma resposta inteira e correta virava lista vazia — que na tela é
 * indistinguível de "a IA não encontrou nada".
 */
describe("normalizeAgentType", () => {
  it.each([
    ["físico", "physical"],
    ["Químico", "chemical"],
    ["BIOLÓGICO", "biological"],
    ["ergonômico", "ergonomic"],
    ["mecânico", "mechanical"],
    ["acidentes", "accident"],
    ["fatores psicossociais", "psychosocial"],
    ["risco físico", "physical"],
    ["agente químico", "chemical"],
  ])("aceita %s como %s", (input, expected) => {
    expect(parseModelSuggestions([{ agentType: input, description: "d" }])).toEqual([
      { agentType: expected, description: "d" },
    ]);
  });

  it("mantém o valor canônico em inglês intacto", () => {
    expect(parseModelSuggestions([{ agentType: "chemical", description: "d" }])).toEqual([
      { agentType: "chemical", description: "d" },
    ]);
  });

  it("continua descartando grupo irreconhecível — tolerar forma não é aceitar qualquer coisa", () => {
    expect(
      parseModelSuggestions([{ agentType: "radioativo", description: "d" }]),
    ).toEqual([]);
  });
});
