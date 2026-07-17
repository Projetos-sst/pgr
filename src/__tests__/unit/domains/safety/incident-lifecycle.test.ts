import {
  canTransitionIncident,
  incidentStatusSchema,
  INCIDENT_STATUSES,
  isTerminalIncidentStatus,
  nextIncidentStatuses,
  requiresJustification,
  validateIncidentTransition,
} from "@/shared/domains/safety/incident-lifecycle";
import {
  accidentCreateSchema,
  accidentStatusTransitionSchema,
} from "@/shared/domains/safety/accident";

describe("incident-lifecycle — matriz de transições (fonte única, US5)", () => {
  it("enum fechado cobre exatamente os 5 estados", () => {
    expect([...INCIDENT_STATUSES]).toEqual([
      "registered",
      "awaiting_planning",
      "awaiting_completion",
      "completed",
      "cancelled",
    ]);
    expect(incidentStatusSchema.safeParse("bogus").success).toBe(false);
  });

  it("avanço linear é permitido", () => {
    expect(canTransitionIncident("registered", "awaiting_planning")).toBe(true);
    expect(canTransitionIncident("awaiting_planning", "awaiting_completion")).toBe(true);
    expect(canTransitionIncident("awaiting_completion", "completed")).toBe(true);
  });

  it("cancelamento é permitido a partir de qualquer estado não terminal", () => {
    expect(canTransitionIncident("registered", "cancelled")).toBe(true);
    expect(canTransitionIncident("awaiting_planning", "cancelled")).toBe(true);
    expect(canTransitionIncident("awaiting_completion", "cancelled")).toBe(true);
  });

  it("pulos e retrocessos são inválidos; terminais não saem", () => {
    expect(canTransitionIncident("registered", "awaiting_completion")).toBe(false);
    expect(canTransitionIncident("registered", "completed")).toBe(false);
    expect(canTransitionIncident("awaiting_completion", "registered")).toBe(false);
    expect(canTransitionIncident("completed", "awaiting_planning")).toBe(false);
    expect(canTransitionIncident("cancelled", "registered")).toBe(false);
    expect(canTransitionIncident("registered", "registered")).toBe(false);
  });

  it("estados terminais são reconhecidos", () => {
    expect(isTerminalIncidentStatus("completed")).toBe(true);
    expect(isTerminalIncidentStatus("cancelled")).toBe(true);
    expect(isTerminalIncidentStatus("registered")).toBe(false);
    expect(isTerminalIncidentStatus("awaiting_completion")).toBe(false);
  });

  it("nextIncidentStatuses lista só alvos legais (vazio nos terminais)", () => {
    expect(nextIncidentStatuses("registered").sort()).toEqual([
      "awaiting_planning",
      "cancelled",
    ]);
    expect(nextIncidentStatuses("completed")).toEqual([]);
    expect(nextIncidentStatuses("cancelled")).toEqual([]);
  });

  it("conclusão e cancelamento exigem justificativa; demais não", () => {
    expect(requiresJustification("completed")).toBe(true);
    expect(requiresJustification("cancelled")).toBe(true);
    expect(requiresJustification("awaiting_planning")).toBe(false);
    expect(requiresJustification("awaiting_completion")).toBe(false);
  });
});

describe("validateIncidentTransition (pura, sem throw)", () => {
  it("aprova transição legal sem justificativa quando não exigida", () => {
    expect(validateIncidentTransition("registered", "awaiting_planning", null)).toEqual({
      ok: true,
    });
  });

  it("reprova transição ilegal", () => {
    expect(validateIncidentTransition("registered", "completed", "x")).toEqual({
      ok: false,
      reason: "invalid_transition",
    });
  });

  it("exige justificativa não vazia em conclusão/cancelamento", () => {
    expect(
      validateIncidentTransition("awaiting_completion", "completed", undefined),
    ).toEqual({ ok: false, reason: "justification_required" });
    expect(validateIncidentTransition("awaiting_completion", "completed", "   ")).toEqual(
      {
        ok: false,
        reason: "justification_required",
      },
    );
    expect(
      validateIncidentTransition("awaiting_completion", "completed", "Ações concluídas"),
    ).toEqual({ ok: true });
    expect(validateIncidentTransition("registered", "cancelled", "Duplicado")).toEqual({
      ok: true,
    });
  });
});

describe("accidentCreateSchema (US4)", () => {
  const base = {
    companyId: "11111111-1111-1111-1111-111111111111",
    occurredAt: "2026-07-10T14:30",
    type: "typical",
    category: "without_leave",
    severity: "minor",
  };

  it("aceita registro mínimo (campos opcionais ausentes)", () => {
    const parsed = accidentCreateSchema.parse(base);
    expect(parsed.type).toBe("typical");
    expect(parsed.employeeId).toBeUndefined();
    expect(parsed.hospital).toBeUndefined();
  });

  it("aceita campos CAT/investigação textuais vazios (→ undefined)", () => {
    const parsed = accidentCreateSchema.parse({
      ...base,
      injuryNatureCode: "",
      injuryNatureDescription: "",
      catNumber: "",
      witnesses: "   ",
    });
    expect(parsed.injuryNatureCode).toBeUndefined();
    expect(parsed.catNumber).toBeUndefined();
    expect(parsed.witnesses).toBeUndefined();
  });

  it("preenche CAT interno textual quando informado", () => {
    const parsed = accidentCreateSchema.parse({
      ...base,
      catNumber: "CAT-2026-001",
      catIssuedAt: "2026-07-11",
    });
    expect(parsed.catNumber).toBe("CAT-2026-001");
    expect(parsed.catIssuedAt).toBe("2026-07-11");
  });

  it("valida os enums fechados", () => {
    expect(() => accidentCreateSchema.parse({ ...base, type: "other" })).toThrow();
    expect(() => accidentCreateSchema.parse({ ...base, category: "x" })).toThrow();
    expect(() => accidentCreateSchema.parse({ ...base, severity: "x" })).toThrow();
  });

  it("exige empresa, data/hora válida e classificação", () => {
    expect(() => accidentCreateSchema.parse({ ...base, companyId: undefined })).toThrow();
    expect(() =>
      accidentCreateSchema.parse({ ...base, occurredAt: "não-data" }),
    ).toThrow();
  });

  it("é strict e rejeita campos server-only do cliente", () => {
    expect(() => accidentCreateSchema.parse({ ...base, orgId: "org_a" })).toThrow();
    expect(() => accidentCreateSchema.parse({ ...base, status: "completed" })).toThrow();
    expect(() =>
      accidentCreateSchema.parse({ ...base, completedAt: "2026-07-11T00:00:00Z" }),
    ).toThrow();
    expect(() =>
      accidentCreateSchema.parse({ ...base, createdAt: "2026-07-11T00:00:00Z" }),
    ).toThrow();
  });
});

describe("accidentStatusTransitionSchema (US5)", () => {
  it("aceita status válido com justificativa opcional; é strict", () => {
    const parsed = accidentStatusTransitionSchema.parse({
      status: "completed",
      justification: "ok",
    });
    expect(parsed.status).toBe("completed");
    expect(parsed.justification).toBe("ok");
    expect(() => accidentStatusTransitionSchema.parse({ status: "bogus" })).toThrow();
    expect(() =>
      accidentStatusTransitionSchema.parse({ status: "completed", extra: 1 }),
    ).toThrow();
  });
});
