import {
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
