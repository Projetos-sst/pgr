import {
  formatTrainingCode,
  nextTrainingNumber,
  trainingCatalogInputSchema,
  trainingValidityLabel,
} from "@/shared/domains/pgr/trainings";

describe("nextTrainingNumber / formatTrainingCode", () => {
  it("sequência começa em 1, incrementa e é defensiva", () => {
    expect(nextTrainingNumber(null)).toBe(1);
    expect(nextTrainingNumber(200)).toBe(201);
    expect(nextTrainingNumber(-1)).toBe(1);
    expect(nextTrainingNumber(Number.NaN)).toBe(1);
  });
  it("formata como TR-0201", () => {
    expect(formatTrainingCode(1)).toBe("TR-0001");
    expect(formatTrainingCode(201)).toBe("TR-0201");
  });
});

describe("trainingValidityLabel (derivado da periodicidade)", () => {
  it("converte periodicidade em meses; single → Única", () => {
    expect(trainingValidityLabel("annual")).toBe("12 meses");
    expect(trainingValidityLabel("biennial")).toBe("24 meses");
    expect(trainingValidityLabel("triennial")).toBe("36 meses");
    expect(trainingValidityLabel("quinquennial")).toBe("60 meses");
    expect(trainingValidityLabel("single")).toBe("Única");
  });
});

describe("trainingCatalogInputSchema — isActive opcional", () => {
  const base = { name: "NR-35", workloadHours: "8", periodicity: "annual" as const };
  it("aceita isActive e mantém opcional (default no repo)", () => {
    expect(trainingCatalogInputSchema.parse({ ...base, isActive: true }).isActive).toBe(
      true,
    );
    expect(trainingCatalogInputSchema.parse(base).isActive).toBeUndefined();
  });
});
