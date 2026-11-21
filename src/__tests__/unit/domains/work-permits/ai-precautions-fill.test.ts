import {
  MAX_PRECAUTION_LENGTH,
  MAX_PRECAUTIONS,
  buildPrecautionsContext,
  mergePrecautions,
  parseModelPrecautions,
  splitPrecautions,
  workPermitPrecautionsFillInputSchema,
} from "@/shared/domains/work-permits/ai-precautions-fill";

describe("workPermitPrecautionsFillInputSchema", () => {
  it("exige a descrição do trabalho", () => {
    const parsed = workPermitPrecautionsFillInputSchema.safeParse({
      type: "height",
      description: "  ",
    });
    expect(parsed.success).toBe(false);
  });

  it("recusa tipo de trabalho fora da lista", () => {
    const parsed = workPermitPrecautionsFillInputSchema.safeParse({
      type: "underwater",
      description: "Mergulho",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("buildPrecautionsContext", () => {
  it("usa o rótulo do tipo, área vazia vira nulo e separa as precauções atuais", () => {
    const ctx = buildPrecautionsContext(
      workPermitPrecautionsFillInputSchema.parse({
        type: "confined_space",
        area: "",
        description: "Limpeza do tanque 3",
        precautions: "- Medir oxigênio\n\n2) Ventilar o tanque",
      }),
    );
    expect(ctx).toEqual({
      typeLabel: "Espaço confinado",
      area: null,
      description: "Limpeza do tanque 3",
      existingPrecautions: ["Medir oxigênio", "Ventilar o tanque"],
    });
  });
});

describe("parseModelPrecautions", () => {
  it("aceita texto solto ou objeto com description", () => {
    expect(
      parseModelPrecautions({
        precautions: ["Isolar a área", { description: "Bloquear a energia" }],
      }),
    ).toEqual(["Isolar a área", "Bloquear a energia"]);
  });

  it("descarta vazio, longo demais, repetido e o que a PT já contém", () => {
    const out = parseModelPrecautions(
      [
        "",
        "x".repeat(MAX_PRECAUTION_LENGTH + 1),
        "Isolar a área",
        "isolar a ÁREA!",
        "Medir oxigênio",
      ],
      ["Medir oxigenio"],
    );
    expect(out).toEqual(["Isolar a área"]);
  });

  it("corta no teto de precauções", () => {
    const many = Array.from({ length: MAX_PRECAUTIONS + 5 }, (_, i) => `Medida ${i}`);
    expect(parseModelPrecautions(many)).toHaveLength(MAX_PRECAUTIONS);
  });

  it("formato desconhecido vira lista vazia", () => {
    expect(parseModelPrecautions("texto")).toEqual([]);
    expect(parseModelPrecautions(null)).toEqual([]);
  });
});

describe("splitPrecautions e mergePrecautions", () => {
  it("tira marcador de lista e linha vazia", () => {
    expect(splitPrecautions("• Um\n* Dois\n\n3. Três")).toEqual(["Um", "Dois", "Três"]);
  });

  it("mantém o que a pessoa escreveu e acrescenta o que veio da IA, um por linha", () => {
    expect(mergePrecautions("Medir oxigênio", ["Isolar a área"])).toBe(
      "- Medir oxigênio\n- Isolar a área",
    );
  });
});
