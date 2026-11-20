import {
  MAX_SUGGESTIONS,
  acceptSuggestedRisksInputSchema,
  applyRiskFill,
  filledRiskFields,
  parseModelSuggestions,
  riskFillFocusSchema,
  toRiskDraft,
  suggestedRiskSchema,
  toRiskValuesFromSuggestion,
  type SuggestedRisk,
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

describe("preenchimento completo do risco pela IA", () => {
  it("aceita propagação, possíveis lesões e tempo de exposição", () => {
    const r = suggestedRiskSchema.parse({
      agentType: "physical",
      description: "Ruído",
      propagation: "Via aérea",
      possibleInjuries: "Perda auditiva induzida por ruído",
      exposureTime: "habitual",
    });
    expect(r.propagation).toBe("Via aérea");
    expect(r.possibleInjuries).toBe("Perda auditiva induzida por ruído");
    expect(r.exposureTime).toBe("habitual");
  });

  it.each([
    ["Intermitente", "intermittent"],
    ["EVENTUAL", "eventual"],
    ["habitual e permanente", "habitual"],
    ["permanente", "habitual"],
    ["menos de 1h", "lt_1h"],
    ["1 a 2h", "1_2h"],
    ["2 a 4h", "2_4h"],
    ["4 a 7h", "4_7h"],
    ["mais de 7h", "gt_7h"],
    ["gt_7h", "gt_7h"],
  ])("aceita o tempo de exposição %s como %s", (input, expected) => {
    expect(
      suggestedRiskSchema.parse({
        agentType: "physical",
        description: "d",
        exposureTime: input,
      }).exposureTime,
    ).toBe(expected);
  });

  it("tempo de exposição irreconhecível vira undefined sem descartar o risco", () => {
    expect(
      parseModelSuggestions([
        { agentType: "physical", description: "Ruído", exposureTime: "às vezes" },
      ]),
    ).toEqual([{ agentType: "physical", description: "Ruído" }]);
  });

  it("propagação e lesões vazias viram undefined", () => {
    const r = suggestedRiskSchema.parse({
      agentType: "physical",
      description: "Ruído",
      propagation: "",
      possibleInjuries: null,
      exposureTime: "",
    });
    expect(r.propagation).toBeUndefined();
    expect(r.possibleInjuries).toBeUndefined();
    expect(r.exposureTime).toBeUndefined();
  });

  it("descarta medição inventada: concentração, unidade e código eSocial nunca passam", () => {
    const [r] = parseModelSuggestions([
      {
        agentType: "physical",
        description: "Ruído",
        concentrationIntensity: "90",
        measurementUnit: "db_a",
        noxiousAgentCode: "02.01.001",
      },
    ]);
    expect(r).toEqual({ agentType: "physical", description: "Ruído" });
  });

  it("toRiskValuesFromSuggestion leva os novos campos ao rascunho", () => {
    const v = toRiskValuesFromSuggestion(GES_ID, {
      agentType: "physical",
      description: "Ruído",
      propagation: "Via aérea",
      possibleInjuries: "PAIR",
      exposureTime: "habitual",
    });
    expect(v.propagation).toBe("Via aérea");
    expect(v.possibleInjuries).toBe("PAIR");
    expect(v.exposureTime).toBe("habitual");
    expect(v.measurementUnit).toBeUndefined();
    expect(v.concentrationIntensity).toBeUndefined();
    expect(v.noxiousAgentCode).toBeUndefined();
  });
});

describe("rascunho editável do risco preenchido", () => {
  const FULL: SuggestedRisk = {
    agentType: "physical",
    description: "Ruído",
    hazard: "Ruído contínuo",
    sources: "Compressor",
    propagation: "Via aérea",
    possibleInjuries: "PAIR",
    exposureTime: "habitual",
  };

  it("toRiskDraft transforma a sugestão em textos de formulário", () => {
    expect(toRiskDraft({ agentType: "chemical", description: "Poeira" })).toEqual({
      agentType: "chemical",
      exposureTime: "",
      hazard: "",
      description: "Poeira",
      sources: "",
      propagation: "",
      possibleInjuries: "",
    });
  });

  it("filledRiskFields lista só os campos que a IA devolveu", () => {
    expect(filledRiskFields({ agentType: "chemical", description: "Poeira" })).toEqual([
      "agentType",
      "description",
    ]);
    expect(filledRiskFields(FULL)).toHaveLength(7);
  });

  it("applyRiskFill troca só o que a IA devolveu e mantém o que o usuário digitou", () => {
    const current = {
      ...toRiskDraft({ agentType: "physical", description: "Minha descrição" }),
      sources: "Fonte do usuário",
    };
    const merged = applyRiskFill(current, {
      agentType: "physical",
      description: "Ruído",
      propagation: "Via aérea",
    });
    expect(merged.sources).toBe("Fonte do usuário");
    expect(merged.description).toBe("Ruído");
    expect(merged.propagation).toBe("Via aérea");
    expect(current.propagation).toBe("");
  });

  it("o rascunho editado é aceito pelo schema de aceite", () => {
    expect(
      acceptSuggestedRisksInputSchema.safeParse({ suggestions: [toRiskDraft(FULL)] })
        .success,
    ).toBe(true);
  });
});

describe("riskFillFocusSchema", () => {
  it("aceita foco vazio e normaliza textos em branco", () => {
    expect(
      riskFillFocusSchema.parse({ agentType: "", hazard: " ", description: "" }),
    ).toEqual({});
  });

  it("aceita foco parcial digitado pelo usuário", () => {
    expect(
      riskFillFocusSchema.parse({
        agentType: "physical",
        description: "Ruído do compressor",
      }),
    ).toEqual({ agentType: "physical", description: "Ruído do compressor" });
  });

  it("rejeita grupo de agente fora do enum", () => {
    expect(riskFillFocusSchema.safeParse({ agentType: "cosmic" }).success).toBe(false);
  });
});
