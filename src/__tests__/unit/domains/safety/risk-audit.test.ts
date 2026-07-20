import {
  RISK_AUDIT_STATUSES,
  canTransitionRiskAudit,
  isTerminalRiskAuditStatus,
  nextRiskAuditStatuses,
  requiresRiskAuditJustification,
  riskAuditCreateSchema,
  riskAuditFiltersSchema,
  riskAuditStatusTransitionSchema,
  validateRiskAuditTransition,
} from "@/shared/domains/safety/risk-audit";

const RISK_ID = "11111111-1111-1111-1111-111111111111";

describe("risk-audit — estados e transições (US7)", () => {
  it("tem exatamente 3 estados", () => {
    expect([...RISK_AUDIT_STATUSES]).toEqual([
      "awaiting_analysis",
      "planning_actions",
      "completed",
    ]);
  });

  it("permite apenas o avanço linear", () => {
    expect(canTransitionRiskAudit("awaiting_analysis", "planning_actions")).toBe(true);
    expect(canTransitionRiskAudit("planning_actions", "completed")).toBe(true);
  });

  it("não reabre estados anteriores nem pula etapas", () => {
    expect(canTransitionRiskAudit("awaiting_analysis", "completed")).toBe(false);
    expect(canTransitionRiskAudit("planning_actions", "awaiting_analysis")).toBe(false);
    expect(canTransitionRiskAudit("completed", "planning_actions")).toBe(false);
    expect(canTransitionRiskAudit("completed", "awaiting_analysis")).toBe(false);
  });

  it("completed é terminal (sem alvos)", () => {
    expect(isTerminalRiskAuditStatus("completed")).toBe(true);
    expect(isTerminalRiskAuditStatus("awaiting_analysis")).toBe(false);
    expect(nextRiskAuditStatuses("completed")).toEqual([]);
    expect(nextRiskAuditStatuses("awaiting_analysis")).toEqual(["planning_actions"]);
  });

  it("conclusão exige justificativa; demais transições não", () => {
    expect(requiresRiskAuditJustification("completed")).toBe(true);
    expect(requiresRiskAuditJustification("planning_actions")).toBe(false);

    expect(validateRiskAuditTransition("planning_actions", "completed", "  ")).toEqual({
      ok: false,
      reason: "justification_required",
    });
    expect(
      validateRiskAuditTransition("planning_actions", "completed", "Tratado"),
    ).toEqual({ ok: true });
    expect(
      validateRiskAuditTransition("awaiting_analysis", "planning_actions", null),
    ).toEqual({ ok: true });
    expect(validateRiskAuditTransition("awaiting_analysis", "completed", "x")).toEqual({
      ok: false,
      reason: "invalid_transition",
    });
  });
});

describe("risk-audit — schemas strict (US7)", () => {
  it("create aceita risk|incident e rejeita origem desconhecida", () => {
    expect(
      riskAuditCreateSchema.safeParse({ originType: "risk", originId: RISK_ID }).success,
    ).toBe(true);
    expect(
      riskAuditCreateSchema.safeParse({ originType: "incident", originId: RISK_ID })
        .success,
    ).toBe(true);
    expect(
      riskAuditCreateSchema.safeParse({ originType: "inspection", originId: RISK_ID })
        .success,
    ).toBe(false);
    expect(
      riskAuditCreateSchema.safeParse({ originType: "non_conformity", originId: RISK_ID })
        .success,
    ).toBe(false);
  });

  it("create rejeita campos server-only (strict)", () => {
    expect(
      riskAuditCreateSchema.safeParse({
        originType: "risk",
        originId: RISK_ID,
        status: "completed",
        orgId: "org_a",
        startedAt: "2026-01-01",
      }).success,
    ).toBe(false);
  });

  it("transition aceita status + justificativa opcional e rejeita extras", () => {
    expect(
      riskAuditStatusTransitionSchema.safeParse({
        status: "completed",
        justification: "ok",
      }).success,
    ).toBe(true);
    expect(
      riskAuditStatusTransitionSchema.safeParse({ status: "planning_actions" }).success,
    ).toBe(true);
    expect(
      riskAuditStatusTransitionSchema.safeParse({
        status: "completed",
        completedAt: "2026-01-01",
      }).success,
    ).toBe(false);
  });

  it("filtros são strict", () => {
    expect(riskAuditFiltersSchema.safeParse({ status: "completed" }).success).toBe(true);
    expect(riskAuditFiltersSchema.safeParse({ bogus: 1 }).success).toBe(false);
  });
});
