import {
  jobRoleRequiredTrainingInputSchema,
  trainingCatalogInputSchema,
  trainingRecordInputSchema,
} from "@/shared/domains/pgr/trainings";
import { todayInSaoPaulo } from "@/shared/dates";

const VALID_CATALOG = {
  name: "NR-35 Trabalho em Altura",
  referenceNorm: "NR-35",
  workloadHours: "8",
  periodicity: "biennial",
} as const;

describe("trainingCatalogInputSchema (US1)", () => {
  it("aceita entrada válida e faz coerce da carga horária", () => {
    const parsed = trainingCatalogInputSchema.parse(VALID_CATALOG);
    expect(parsed.workloadHours).toBe(8);
    expect(parsed.periodicity).toBe("biennial");
    expect(parsed.description).toBeUndefined();
  });

  it("nome vazio → erro", () => {
    const result = trainingCatalogInputSchema.safeParse({ ...VALID_CATALOG, name: " " });
    expect(result.success).toBe(false);
  });

  it("carga horária zero → erro", () => {
    const result = trainingCatalogInputSchema.safeParse({
      ...VALID_CATALOG,
      workloadHours: "0",
    });
    expect(result.success).toBe(false);
  });

  it("carga horária negativa → erro", () => {
    const result = trainingCatalogInputSchema.safeParse({
      ...VALID_CATALOG,
      workloadHours: "-4",
    });
    expect(result.success).toBe(false);
  });

  it("carga horária não-inteira → erro", () => {
    const result = trainingCatalogInputSchema.safeParse({
      ...VALID_CATALOG,
      workloadHours: "7.5",
    });
    expect(result.success).toBe(false);
  });

  it("periodicidade fora do enum → erro", () => {
    const result = trainingCatalogInputSchema.safeParse({
      ...VALID_CATALOG,
      periodicity: "monthly",
    });
    expect(result.success).toBe(false);
  });
});

const EMPLOYEE_ID = "11111111-1111-1111-1111-111111111111";
const TRAINING_ID = "22222222-2222-2222-2222-222222222222";

describe("trainingRecordInputSchema (US2)", () => {
  it("aceita registro válido com certificado ausente (opcional)", () => {
    const parsed = trainingRecordInputSchema.parse({
      employeeId: EMPLOYEE_ID,
      trainingId: TRAINING_ID,
      completedAt: "2026-01-15",
    });
    expect(parsed.certificatePath).toBeUndefined();
  });

  it("aceita certificado informado", () => {
    const parsed = trainingRecordInputSchema.parse({
      employeeId: EMPLOYEE_ID,
      trainingId: TRAINING_ID,
      completedAt: "2026-01-15",
      certificatePath: "certificados/nr35.pdf",
    });
    expect(parsed.certificatePath).toBe("certificados/nr35.pdf");
  });

  it("completed_at hoje (America/Sao_Paulo) é aceito — fronteira inclusiva", () => {
    const result = trainingRecordInputSchema.safeParse({
      employeeId: EMPLOYEE_ID,
      trainingId: TRAINING_ID,
      completedAt: todayInSaoPaulo(),
    });
    expect(result.success).toBe(true);
  });

  it("completed_at no futuro → erro", () => {
    const result = trainingRecordInputSchema.safeParse({
      employeeId: EMPLOYEE_ID,
      trainingId: TRAINING_ID,
      completedAt: "2099-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("data de calendário impossível → erro", () => {
    const result = trainingRecordInputSchema.safeParse({
      employeeId: EMPLOYEE_ID,
      trainingId: TRAINING_ID,
      completedAt: "2026-13-45",
    });
    expect(result.success).toBe(false);
  });

  it("uuid inválido → erro", () => {
    const result = trainingRecordInputSchema.safeParse({
      employeeId: "not-a-uuid",
      trainingId: TRAINING_ID,
      completedAt: "2026-01-15",
    });
    expect(result.success).toBe(false);
  });
});

describe("jobRoleRequiredTrainingInputSchema (US4)", () => {
  it("aceita par de uuids válido", () => {
    const parsed = jobRoleRequiredTrainingInputSchema.parse({
      jobRoleId: EMPLOYEE_ID,
      trainingId: TRAINING_ID,
    });
    expect(parsed.jobRoleId).toBe(EMPLOYEE_ID);
  });

  it("campo ausente → erro", () => {
    const result = jobRoleRequiredTrainingInputSchema.safeParse({
      jobRoleId: EMPLOYEE_ID,
    });
    expect(result.success).toBe(false);
  });
});
