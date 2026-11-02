import {
  EXAM_DUE_WINDOW_DAYS,
  HEALTH_EXAM_CERTIFICATE_PATH_MAX,
  HEALTH_EXAM_NOTES_MAX,
  VALID_UNTIL_BEFORE_PERFORMED_MESSAGE,
  examBadge,
  healthExamInputSchema,
  healthExamListFiltersSchema,
  isValidUntilBeforePerformedAt,
} from "@/shared/domains/pgr/health-exams";

const EMP = "11111111-1111-1111-1111-1111111111a4";
const DOC = "11111111-1111-1111-1111-1111111111c1";

describe("healthExamInputSchema", () => {
  const base = {
    employeeId: EMP,
    examType: "periodic",
    performedAt: "2026-01-14",
    aptitude: "fit",
  };

  it("aceita entrada mínima válida (doctor/validUntil/notes opcionais)", () => {
    const parsed = healthExamInputSchema.parse(base);
    expect(parsed.employeeId).toBe(EMP);
    expect(parsed.examType).toBe("periodic");
    expect(parsed.aptitude).toBe("fit");
    expect(parsed.doctorId).toBeUndefined();
    expect(parsed.validUntil).toBeUndefined();
  });

  it("aceita médico, vencimento e observações", () => {
    const parsed = healthExamInputSchema.parse({
      ...base,
      doctorId: DOC,
      validUntil: "2027-01-14",
      aptitude: "fit_with_restrictions",
      notes: "uso de EPI auditivo",
    });
    expect(parsed.doctorId).toBe(DOC);
    expect(parsed.validUntil).toBe("2027-01-14");
    expect(parsed.aptitude).toBe("fit_with_restrictions");
  });

  it("exige funcionário (uuid) e rejeita tipo/aptidão inválidos", () => {
    expect(() => healthExamInputSchema.parse({ ...base, employeeId: "x" })).toThrow();
    expect(() => healthExamInputSchema.parse({ ...base, examType: "annual" })).toThrow();
    expect(() => healthExamInputSchema.parse({ ...base, aptitude: "maybe" })).toThrow();
  });

  it("rejeita data de realização no futuro", () => {
    expect(() =>
      healthExamInputSchema.parse({ ...base, performedAt: "2999-01-01" }),
    ).toThrow();
  });
});

function issuesOf(input: unknown): Record<string, string> {
  const result = healthExamInputSchema.safeParse(input);
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

describe("healthExamInputSchema — vencimento × realização (Lote 02A)", () => {
  const base = {
    employeeId: EMP,
    examType: "periodic",
    performedAt: "2026-01-14",
    aptitude: "fit",
  };

  it("vencimento posterior à realização → aceito", () => {
    expect(
      healthExamInputSchema.parse({ ...base, validUntil: "2027-01-14" }).validUntil,
    ).toBe("2027-01-14");
  });

  it("vencimento igual à realização → aceito", () => {
    expect(
      healthExamInputSchema.parse({ ...base, validUntil: "2026-01-14" }).validUntil,
    ).toBe("2026-01-14");
  });

  it("vencimento anterior à realização → erro no campo validUntil", () => {
    expect(issuesOf({ ...base, validUntil: "2026-01-13" })).toEqual({
      validUntil: VALID_UNTIL_BEFORE_PERFORMED_MESSAGE,
    });
    expect(VALID_UNTIL_BEFORE_PERFORMED_MESSAGE).toBe(
      "Vencimento anterior à realização.",
    );
  });

  it("vencimento ausente ou vazio → aceito (campo opcional)", () => {
    expect(healthExamInputSchema.parse(base).validUntil).toBeUndefined();
    expect(
      healthExamInputSchema.parse({ ...base, validUntil: "" }).validUntil,
    ).toBeUndefined();
  });

  it("formato inválido → erro de data, sem a regra de ordem", () => {
    const issues = issuesOf({ ...base, validUntil: "14/01/2027" });
    expect(issues.validUntil).toBe("Data inválida (use AAAA-MM-DD)");
    expect(issuesOf({ ...base, validUntil: "2026-02-30" }).validUntil).toBe(
      "Data inválida (use AAAA-MM-DD)",
    );
    expect(issuesOf({ ...base, performedAt: "ontem" }).performedAt).toBe(
      "Data inválida (use AAAA-MM-DD)",
    );
  });

  it("a regra de ordem aparece mesmo com erro em outro campo", () => {
    const issues = issuesOf({ ...base, aptitude: "", validUntil: "2025-12-31" });
    expect(issues.aptitude).toBe("Aptidão inválida");
    expect(issues.validUntil).toBe(VALID_UNTIL_BEFORE_PERFORMED_MESSAGE);
  });

  it("virada de ano/mês compara como calendário (sem fuso)", () => {
    expect(isValidUntilBeforePerformedAt("2026-01-01", "2025-12-31")).toBe(true);
    expect(isValidUntilBeforePerformedAt("2026-03-01", "2026-02-28")).toBe(true);
    expect(isValidUntilBeforePerformedAt("2026-02-28", "2026-03-01")).toBe(false);
    expect(isValidUntilBeforePerformedAt("2026-02-28", "2026-02-28")).toBe(false);
    expect(isValidUntilBeforePerformedAt("2026-02-28", null)).toBe(false);
    expect(isValidUntilBeforePerformedAt("2026-02-28", "lixo")).toBe(false);
  });
});

describe("healthExamInputSchema — tipo de exame (Lote 02A)", () => {
  const base = {
    employeeId: EMP,
    performedAt: "2026-01-14",
    aptitude: "fit",
  };

  it.each([
    "admissional",
    "periodic",
    "change_of_function",
    "return_to_work",
    "dismissal",
  ])("tipo válido %s → aceito sem troca de valor", (examType) => {
    expect(healthExamInputSchema.parse({ ...base, examType }).examType).toBe(examType);
  });

  it.each(["annual", "", "PERIODIC", 3, null])(
    "tipo inválido %p → erro, sem valor padrão",
    (examType) => {
      expect(issuesOf({ ...base, examType }).examType).toBe("Tipo de exame inválido");
    },
  );

  it("tipo ausente → erro", () => {
    expect(issuesOf(base).examType).toBe("Tipo de exame inválido");
  });
});

describe("healthExamInputSchema — limites dos campos administrativos (Lote 02A)", () => {
  const base = {
    employeeId: EMP,
    examType: "periodic",
    performedAt: "2026-01-14",
    aptitude: "fit",
  };

  it("limites planejados: notes 2.000 e certificatePath 500", () => {
    expect(HEALTH_EXAM_NOTES_MAX).toBe(2000);
    expect(HEALTH_EXAM_CERTIFICATE_PATH_MAX).toBe(500);
  });

  it("notes no limite → aceito; acima → erro sem ecoar o conteúdo", () => {
    const atLimit = "a".repeat(HEALTH_EXAM_NOTES_MAX);
    expect(healthExamInputSchema.parse({ ...base, notes: atLimit }).notes).toBe(atLimit);

    const secret = `EXEMPLO-SIGILO ${"b".repeat(HEALTH_EXAM_NOTES_MAX)}`;
    const issues = issuesOf({ ...base, notes: secret });
    expect(issues.notes).toBe("Observações: máximo de 2.000 caracteres.");
    expect(JSON.stringify(issues)).not.toContain("EXEMPLO-SIGILO");
  });

  it("notes conta após o trim (espaços nas pontas não estouram o limite)", () => {
    const padded = `  ${"a".repeat(HEALTH_EXAM_NOTES_MAX)}  `;
    expect(healthExamInputSchema.parse({ ...base, notes: padded }).notes).toHaveLength(
      HEALTH_EXAM_NOTES_MAX,
    );
  });

  it("certificatePath no limite → aceito; acima → erro", () => {
    const atLimit = "p".repeat(HEALTH_EXAM_CERTIFICATE_PATH_MAX);
    expect(
      healthExamInputSchema.parse({ ...base, certificatePath: atLimit }).certificatePath,
    ).toBe(atLimit);
    expect(issuesOf({ ...base, certificatePath: `${atLimit}x` }).certificatePath).toBe(
      "Caminho do ASO: máximo de 500 caracteres.",
    );
  });

  it("vazios continuam virando undefined", () => {
    const parsed = healthExamInputSchema.parse({
      ...base,
      notes: "  ",
      certificatePath: "",
    });
    expect(parsed.notes).toBeUndefined();
    expect(parsed.certificatePath).toBeUndefined();
  });
});

describe("examBadge (validade derivada + aptidão)", () => {
  const ctx = { today: "2026-08-02", dueWindowDays: 30 };

  it("vencido → vermelho, independente da aptidão", () => {
    expect(examBadge("2020-01-01", "fit", ctx)).toEqual({
      tone: "red",
      label: "Vencido",
    });
  });

  it("a vencer (dentro da janela) → âmbar", () => {
    expect(examBadge("2026-08-20", "fit", ctx)).toEqual({
      tone: "amber",
      label: "A vencer",
    });
  });

  it("vigente → mostra a aptidão", () => {
    expect(examBadge("2030-01-01", "fit", ctx)).toEqual({ tone: "green", label: "Apto" });
    expect(examBadge("2030-01-01", "fit_with_restrictions", ctx)).toEqual({
      tone: "amber",
      label: "Apto c/ restrição",
    });
    expect(examBadge("2030-01-01", "unfit", ctx)).toEqual({
      tone: "red",
      label: "Inapto",
    });
  });

  it("sem validade (null) → trata como vigente e mostra aptidão", () => {
    expect(examBadge(null, "fit", ctx)).toEqual({ tone: "green", label: "Apto" });
  });
});

describe("healthExamListFiltersSchema (filtros por funcionário/empresa)", () => {
  const COMPANY = "11111111-1111-1111-1111-111111111111";

  it("sem filtros → ambos undefined", () => {
    expect(healthExamListFiltersSchema.parse({})).toEqual({
      employeeId: undefined,
      companyId: undefined,
    });
  });

  it("string vazia/espaços → undefined (não é filtro)", () => {
    const parsed = healthExamListFiltersSchema.parse({ employeeId: "", companyId: "  " });
    expect(parsed.employeeId).toBeUndefined();
    expect(parsed.companyId).toBeUndefined();
  });

  it("UUIDs válidos passam", () => {
    expect(
      healthExamListFiltersSchema.parse({ employeeId: EMP, companyId: COMPANY }),
    ).toEqual({ employeeId: EMP, companyId: COMPANY });
  });

  it("ID malformado → erro (vira VALIDATION, nunca lista vazia)", () => {
    expect(healthExamListFiltersSchema.safeParse({ employeeId: "abc" }).success).toBe(
      false,
    );
    expect(healthExamListFiltersSchema.safeParse({ companyId: "invalido" }).success).toBe(
      false,
    );
    expect(healthExamListFiltersSchema.safeParse({ employeeId: `${EMP}0` }).success).toBe(
      false,
    );
  });
});

describe("EXAM_DUE_WINDOW_DAYS", () => {
  it("janela única de 30 dias", () => {
    expect(EXAM_DUE_WINDOW_DAYS).toBe(30);
  });
});

describe("healthExamListFiltersSchema — examType (Lote 02A)", () => {
  it("tipo válido passa; vazio vira undefined", () => {
    expect(healthExamListFiltersSchema.parse({ examType: "dismissal" }).examType).toBe(
      "dismissal",
    );
    expect(healthExamListFiltersSchema.parse({ examType: "" }).examType).toBeUndefined();
  });

  it("tipo inválido → erro (nunca ignorado em silêncio)", () => {
    const result = healthExamListFiltersSchema.safeParse({ examType: "annual" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Tipo de exame inválido");
  });
});
