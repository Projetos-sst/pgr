import {
  controlMeasureInputSchema,
  deriveMeasureState,
  isOverdue,
  measureStateLabel,
} from "@/shared/domains/pgr/control-measure";

const TODAY = "2026-07-09";

function base(overrides: Record<string, unknown> = {}) {
  return { controlLevel: "elimination", applicable: false, ...overrides };
}

describe("controlMeasureInputSchema", () => {
  it("aceita os 4 níveis NR-01 válidos", () => {
    for (const level of [
      "elimination",
      "collective_protection",
      "administrative",
      "ppe",
    ]) {
      expect(
        controlMeasureInputSchema.safeParse(base({ controlLevel: level })).success,
      ).toBe(true);
    }
  });

  it("rejeita controlLevel inválido", () => {
    expect(
      controlMeasureInputSchema.safeParse(base({ controlLevel: "epi" })).success,
    ).toBe(false);
  });

  it("applicable=false → todos os campos 5W2H são opcionais", () => {
    const parsed = controlMeasureInputSchema.safeParse(base({ applicable: false }));
    expect(parsed.success).toBe(true);
  });

  it("applicable string 'false' vira false (sem bug do coerce) e não exige 5W2H", () => {
    const parsed = controlMeasureInputSchema.safeParse(base({ applicable: "false" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.applicable).toBe(false);
  });

  it("applicable string 'on'/'true'/'1' vira true", () => {
    for (const v of ["on", "true", "1"]) {
      const parsed = controlMeasureInputSchema.safeParse(
        base({ applicable: v, actionWhat: "x", actionHow: "y" }),
      );
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.applicable).toBe(true);
    }
  });

  it("applicable=true exige actionWhat", () => {
    const parsed = controlMeasureInputSchema.safeParse(
      base({ applicable: true, actionHow: "como" }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join(".") === "actionWhat")).toBe(
        true,
      );
    }
  });

  it("applicable=true exige actionHow", () => {
    const parsed = controlMeasureInputSchema.safeParse(
      base({ applicable: true, actionWhat: "o quê" }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join(".") === "actionHow")).toBe(
        true,
      );
    }
  });

  it("applicable=true com actionWhat e actionHow é válido", () => {
    const parsed = controlMeasureInputSchema.safeParse(
      base({ applicable: true, actionWhat: "o quê", actionHow: "como" }),
    );
    expect(parsed.success).toBe(true);
  });

  it("responsável é texto livre (aceita qualquer string)", () => {
    const parsed = controlMeasureInputSchema.safeParse(
      base({ actionResponsible: "Fulano de Tal (Eng.)" }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success)
      expect(parsed.data.actionResponsible).toBe("Fulano de Tal (Eng.)");
  });

  it("actionDeadline vazio → undefined; data válida é aceita", () => {
    const empty = controlMeasureInputSchema.safeParse(base({ actionDeadline: "" }));
    expect(empty.success && empty.data.actionDeadline).toBeUndefined();
    const dated = controlMeasureInputSchema.safeParse(
      base({ actionDeadline: "2026-09-30" }),
    );
    expect(dated.success && dated.data.actionDeadline).toBe("2026-09-30");
  });

  it("não aceita/expõe nenhum campo de status persistido", () => {
    const parsed = controlMeasureInputSchema.safeParse(
      base({ status: "completed", applicable: false }),
    );
    // Campo extra é ignorado; o schema não tem `status`.
    expect(parsed.success).toBe(true);
    if (parsed.success) expect("status" in parsed.data).toBe(false);
  });
});

describe("isOverdue / deriveMeasureState (estado derivado, sem coluna de status)", () => {
  it("without_plan quando não aplicável", () => {
    expect(
      deriveMeasureState({ applicable: false, actionDeadline: "2020-01-01" }, TODAY),
    ).toBe("without_plan");
  });

  it("planned quando aplicável e não vencida (prazo futuro)", () => {
    expect(
      deriveMeasureState({ applicable: true, actionDeadline: "2026-12-31" }, TODAY),
    ).toBe("planned");
  });

  it("planned quando aplicável sem prazo (nunca vencida)", () => {
    expect(deriveMeasureState({ applicable: true, actionDeadline: null }, TODAY)).toBe(
      "planned",
    );
  });

  it("overdue quando aplicável e prazo anterior a hoje", () => {
    expect(
      deriveMeasureState({ applicable: true, actionDeadline: "2026-07-08" }, TODAY),
    ).toBe("overdue");
  });

  it("isOverdue: prazo passado vencido; futuro e ausente não vencidos", () => {
    expect(isOverdue(true, "2026-07-08", TODAY)).toBe(true);
    expect(isOverdue(true, "2026-07-10", TODAY)).toBe(false);
    expect(isOverdue(true, null, TODAY)).toBe(false);
    expect(isOverdue(false, "2020-01-01", TODAY)).toBe(false);
  });

  it("labels pt-BR dos estados", () => {
    expect(measureStateLabel("without_plan")).toBe("Sem plano");
    expect(measureStateLabel("planned")).toBe("Planejada");
    expect(measureStateLabel("overdue")).toBe("Vencida");
  });
});
