import { examBadge, healthExamInputSchema } from "@/shared/domains/pgr/health-exams";

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
