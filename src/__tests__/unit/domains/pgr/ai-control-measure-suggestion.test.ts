import {
  acceptSuggestedMeasuresInputSchema,
  dropExistingLevels,
  normalizeControlLevel,
  parseModelMeasures,
  toControlMeasureValuesFromSuggestion,
  type SuggestedControlMeasure,
} from "@/shared/domains/pgr/ai-control-measure-suggestion";

const medida = (controlLevel: string) => ({
  controlLevel,
  actionWhat: "Instalar enclausuramento acústico",
  actionHow: "Contratar projeto e executar a instalação",
});

describe("normalizeControlLevel", () => {
  it.each([
    ["eliminação", "elimination"],
    ["Proteção Coletiva", "collective_protection"],
    ["EPC", "collective_protection"],
    ["controle administrativo", "administrative"],
    ["EPI", "ppe"],
    ["medida de eliminação", "elimination"],
  ])("aceita %s como %s", (input, expected) => {
    expect(normalizeControlLevel(input)).toBe(expected);
  });

  it("deixa o desconhecido passar para o enum reprovar", () => {
    expect(parseModelMeasures({ measures: [medida("mágica")] })).toEqual([]);
  });
});

describe("parseModelMeasures", () => {
  it("aceita envelope { measures } e array cru", () => {
    expect(parseModelMeasures({ measures: [medida("ppe")] })).toHaveLength(1);
    expect(parseModelMeasures([medida("ppe")])).toHaveLength(1);
  });

  it("descarta item inválido sem derrubar o lote", () => {
    const out = parseModelMeasures({
      measures: [{ controlLevel: "ppe" }, medida("administrative")],
    });
    expect(out.map((m) => m.controlLevel)).toEqual(["administrative"]);
  });

  /** `uq_control_measures_org_risk_level` admite uma medida por nível por risco. */
  it("mantém só a primeira medida de cada nível", () => {
    const out = parseModelMeasures({ measures: [medida("ppe"), medida("ppe")] });
    expect(out).toHaveLength(1);
  });

  it("ordena pela hierarquia da NR-01, não pela ordem do modelo", () => {
    const out = parseModelMeasures({
      measures: [medida("ppe"), medida("elimination"), medida("administrative")],
    });
    expect(out.map((m) => m.controlLevel)).toEqual([
      "elimination",
      "administrative",
      "ppe",
    ]);
  });

  it("trata lista vazia e formato inesperado como resultado vazio", () => {
    expect(parseModelMeasures({ measures: [] })).toEqual([]);
    expect(parseModelMeasures({ nada: true })).toEqual([]);
    expect(parseModelMeasures(null)).toEqual([]);
  });
});

describe("dropExistingLevels", () => {
  it("remove o nível que o risco já tem — a UNIQUE recusaria no aceite", () => {
    const measures = parseModelMeasures({
      measures: [medida("elimination"), medida("ppe")],
    });
    expect(dropExistingLevels(measures, ["ppe"]).map((m) => m.controlLevel)).toEqual([
      "elimination",
    ]);
  });
});

describe("toControlMeasureValuesFromSuggestion", () => {
  const s: SuggestedControlMeasure = {
    controlLevel: "collective_protection",
    actionWhat: "Instalar barreira acústica",
    actionHow: "Executar projeto",
    monitoring: "Medição semestral",
    justification: undefined,
  };

  it("entra como aplicável e sem status — quem decide o status é a regra do servidor", () => {
    const v = toControlMeasureValuesFromSuggestion(s);
    expect(v.applicable).toBe(true);
    expect(v.status).toBeUndefined();
  });

  /** Responsável e prazo são compromisso de pessoa, não palpite de modelo. */
  it("nunca preenche responsável nem prazo", () => {
    const v = toControlMeasureValuesFromSuggestion(s);
    expect(v.actionResponsible).toBeUndefined();
    expect(v.actionDeadline).toBeUndefined();
  });
});

/**
 * Regra da issue #42: risco moderado+ com medida aplicável exige responsável e prazo, e
 * `createControlMeasure` recusa com `VALIDATION` quem não os traz. A IA não preenche
 * esses dois de propósito — então eles precisam atravessar o aceite vindos da tela, ou o
 * usuário perde o lote inteiro de sugestões num erro do servidor.
 */
describe("aceite de medida sugerida — responsável e prazo", () => {
  const base = {
    controlLevel: "collective_protection" as const,
    actionWhat: "Enclausurar a fonte de ruído",
    actionHow: "Instalar cabine acústica e verificar por dosimetria",
  };

  it("preserva responsável e prazo informados na revisão", () => {
    const parsed = acceptSuggestedMeasuresInputSchema.parse({
      suggestions: [
        { ...base, actionResponsible: "SESMT", actionDeadline: "2026-12-31" },
      ],
    });
    const values = toControlMeasureValuesFromSuggestion(parsed.suggestions[0]!);
    expect(values.actionResponsible).toBe("SESMT");
    expect(values.actionDeadline).toBe("2026-12-31");
  });

  it("aceita sem os dois campos (risco trivial/tolerável não os exige)", () => {
    const parsed = acceptSuggestedMeasuresInputSchema.parse({ suggestions: [base] });
    const values = toControlMeasureValuesFromSuggestion(parsed.suggestions[0]!);
    expect(values.actionResponsible).toBeUndefined();
    expect(values.actionDeadline).toBeUndefined();
  });

  it("recusa prazo em formato inválido antes de chegar ao banco", () => {
    expect(() =>
      acceptSuggestedMeasuresInputSchema.parse({
        suggestions: [{ ...base, actionDeadline: "31/12/2026" }],
      }),
    ).toThrow();
  });

  it("a medida aceita continua entrando como aplicável e sem status fixado", () => {
    const values = toControlMeasureValuesFromSuggestion({ ...base });
    expect(values.applicable).toBe(true);
    expect(values.status).toBeUndefined();
  });
});
