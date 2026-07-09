import {
  methodologyInputSchema,
  classify,
  buildMatrix,
  riskClassificationLabel,
  methodologyBaseLabel,
  riskClassificationSchema,
  methodologyBaseSchema,
  RISK_CLASSIFICATION_ORDER,
  type ClassificationBand,
} from "@/shared/domains/pgr/methodology";
import {
  METHODOLOGY_PRESETS,
  presetFor,
  defaultRiskMethodology,
  NR01_CONTROL_HIERARCHY,
} from "@/shared/domains/pgr/methodology-presets";

const BANDS: ClassificationBand[] = [
  { classification: "trivial", maxLevel: 2 },
  { classification: "tolerable", maxLevel: 6 },
  { classification: "moderate", maxLevel: 12 },
  { classification: "substantial", maxLevel: 20 },
  { classification: "intolerable", maxLevel: 25 },
];

describe("enums da metodologia", () => {
  it("risk_classification tem as 5 classes em ordem crescente de gravidade", () => {
    expect(riskClassificationSchema.options).toEqual(RISK_CLASSIFICATION_ORDER);
    expect(riskClassificationSchema.options).toHaveLength(5);
  });

  it("methodology_base cobre AIHA / AS-NZS / Fundacentro / Personalizada", () => {
    expect(methodologyBaseSchema.options).toEqual([
      "aiha",
      "as_nzs_4360",
      "fundacentro",
      "custom",
    ]);
  });
});

describe("classify — nível de risco → classe", () => {
  it("classifica os limites de cada faixa", () => {
    expect(classify(1, BANDS)).toBe("trivial");
    expect(classify(2, BANDS)).toBe("trivial");
    expect(classify(3, BANDS)).toBe("tolerable");
    expect(classify(6, BANDS)).toBe("tolerable");
    expect(classify(7, BANDS)).toBe("moderate");
    expect(classify(12, BANDS)).toBe("moderate");
    expect(classify(13, BANDS)).toBe("substantial");
    expect(classify(20, BANDS)).toBe("substantial");
    expect(classify(21, BANDS)).toBe("intolerable");
    expect(classify(25, BANDS)).toBe("intolerable");
  });

  it("limita níveis fora de 1–25 às pontas", () => {
    expect(classify(0, BANDS)).toBe("trivial");
    expect(classify(-5, BANDS)).toBe("trivial");
    expect(classify(99, BANDS)).toBe("intolerable");
  });
});

describe("buildMatrix — 25 células derivadas", () => {
  const matrix = buildMatrix(BANDS);

  it("gera exatamente 25 células (5×5)", () => {
    expect(matrix).toHaveLength(25);
  });

  it("os cantos têm nível e classe coerentes", () => {
    const cell = (p: number, s: number) =>
      matrix.find((c) => c.probability === p && c.severity === s)!;
    expect(cell(1, 1)).toMatchObject({ level: 1, classification: "trivial" });
    expect(cell(5, 5)).toMatchObject({ level: 25, classification: "intolerable" });
    expect(cell(3, 3)).toMatchObject({ level: 9, classification: "moderate" });
  });
});

describe("methodologyInputSchema — validação", () => {
  const valid = presetFor("fundacentro");

  it("aceita uma metodologia bem-formada", () => {
    expect(() => methodologyInputSchema.parse(valid)).not.toThrow();
  });

  it("rejeita número de gradações diferente de 5", () => {
    const bad = { ...valid, probabilityGrades: valid.probabilityGrades.slice(0, 4) };
    expect(() => methodologyInputSchema.parse(bad)).toThrow();
  });

  it("rejeita gradações fora de ordem 1..5", () => {
    const grades = [...valid.severityGrades].reverse();
    expect(() =>
      methodologyInputSchema.parse({ ...valid, severityGrades: grades }),
    ).toThrow();
  });

  it("rejeita faixas com limites não crescentes", () => {
    const bands = [
      { classification: "trivial", maxLevel: 10 },
      { classification: "tolerable", maxLevel: 6 },
      { classification: "moderate", maxLevel: 12 },
      { classification: "substantial", maxLevel: 20 },
      { classification: "intolerable", maxLevel: 25 },
    ];
    expect(() =>
      methodologyInputSchema.parse({ ...valid, classificationBands: bands }),
    ).toThrow();
  });

  it("rejeita última faixa que não fecha em 25", () => {
    const bands = [
      { classification: "trivial", maxLevel: 2 },
      { classification: "tolerable", maxLevel: 6 },
      { classification: "moderate", maxLevel: 12 },
      { classification: "substantial", maxLevel: 18 },
      { classification: "intolerable", maxLevel: 22 },
    ];
    expect(() =>
      methodologyInputSchema.parse({ ...valid, classificationBands: bands }),
    ).toThrow();
  });

  it("rejeita rótulo de gradação vazio", () => {
    const grades = valid.probabilityGrades.map((g, i) =>
      i === 0 ? { ...g, label: "  " } : g,
    );
    expect(() =>
      methodologyInputSchema.parse({ ...valid, probabilityGrades: grades }),
    ).toThrow();
  });
});

describe("presets", () => {
  it("todos os presets são bem-formados", () => {
    for (const base of Object.keys(
      METHODOLOGY_PRESETS,
    ) as (keyof typeof METHODOLOGY_PRESETS)[]) {
      expect(() => methodologyInputSchema.parse(presetFor(base))).not.toThrow();
    }
  });

  it("a metodologia padrão (fallback) é válida e usa Fundacentro", () => {
    const d = defaultRiskMethodology();
    expect(d.base).toBe("fundacentro");
    expect(() => methodologyInputSchema.parse(d)).not.toThrow();
  });

  it("a hierarquia NR-01 tem 4 níveis", () => {
    expect(NR01_CONTROL_HIERARCHY).toHaveLength(4);
    expect(NR01_CONTROL_HIERARCHY.map((n) => n.level)).toEqual([
      "elimination",
      "collective_protection",
      "administrative",
      "ppe",
    ]);
  });
});

describe("rótulos pt-BR", () => {
  it("traduz classes e bases", () => {
    expect(riskClassificationLabel("substantial")).toBe("Substancial");
    expect(riskClassificationLabel("intolerable")).toBe("Intolerável");
    expect(methodologyBaseLabel("as_nzs_4360")).toBe("AS/NZS 4360");
    expect(methodologyBaseLabel("custom")).toBe("Personalizada");
  });
});
