import {
  actionPlanCreateSchema,
  actionPlanFiltersSchema,
  actionPlanPriorityLabel,
  actionPlanStatusTransitionSchema,
  actionPlanUpdateSchema,
  canTransitionActionPlan,
  computeActionPlanOverdue,
  isActionPlanActive,
  isActionPlanTerminal,
} from "@/shared/domains/safety/action-plan";
import {
  actionPlanOriginTypeSchema,
  ACTION_PLAN_ORIGIN_TYPES,
} from "@/shared/domains/safety/action-plan-origin";

const base = {
  originType: "risk" as const,
  originId: "11111111-1111-1111-1111-111111111111",
  what: "Instalar proteção coletiva",
  why: "Reduzir exposição ao ruído",
  who: "SESMT",
  where: "Setor de usinagem",
  how: "Enclausuramento acústico",
};

describe("action-plan-origin (US6 + issue #51)", () => {
  it("aceita risk|incident|control_measure", () => {
    expect([...ACTION_PLAN_ORIGIN_TYPES]).toEqual(["risk", "incident", "control_measure"]);
    expect(actionPlanOriginTypeSchema.safeParse("risk").success).toBe(true);
    expect(actionPlanOriginTypeSchema.safeParse("incident").success).toBe(true);
    expect(actionPlanOriginTypeSchema.safeParse("control_measure").success).toBe(true);
    expect(actionPlanOriginTypeSchema.safeParse("inspection").success).toBe(false);
    expect(actionPlanOriginTypeSchema.safeParse("non_conformity").success).toBe(false);
    expect(actionPlanOriginTypeSchema.safeParse("qualquer").success).toBe(false);
  });
});

describe("actionPlanCreateSchema (5W2H, US6)", () => {
  it("aceita 5W2H mínimo com origem", () => {
    const parsed = actionPlanCreateSchema.parse(base);
    expect(parsed.what).toBe("Instalar proteção coletiva");
    expect(parsed.when).toBeUndefined();
    expect(parsed.priority).toBeUndefined();
  });

  it("aceita prioridade 1–3 e prazo/custo opcionais", () => {
    const parsed = actionPlanCreateSchema.parse({
      ...base,
      priority: 2,
      when: "2026-08-01",
      howMuch: 1500.5,
    });
    expect(parsed.priority).toBe(2);
    expect(parsed.when).toBe("2026-08-01");
    expect(parsed.howMuch).toBe(1500.5);
  });

  it("rejeita prioridade fora de 1–3", () => {
    expect(() => actionPlanCreateSchema.parse({ ...base, priority: 0 })).toThrow();
    expect(() => actionPlanCreateSchema.parse({ ...base, priority: 4 })).toThrow();
  });

  it("exige todos os campos 5W2H obrigatórios", () => {
    expect(() => actionPlanCreateSchema.parse({ ...base, what: "" })).toThrow();
    expect(() => actionPlanCreateSchema.parse({ ...base, why: "   " })).toThrow();
    const { how: _omit, ...noHow } = base;
    void _omit;
    expect(() => actionPlanCreateSchema.parse(noHow)).toThrow();
  });

  it("é strict e rejeita campos server-only do cliente", () => {
    expect(() => actionPlanCreateSchema.parse({ ...base, orgId: "org_a" })).toThrow();
    expect(() =>
      actionPlanCreateSchema.parse({ ...base, status: "completed" }),
    ).toThrow();
    expect(() =>
      actionPlanCreateSchema.parse({ ...base, completedAt: "2026-08-01T00:00:00Z" }),
    ).toThrow();
    expect(() =>
      actionPlanCreateSchema.parse({ ...base, cancelledAt: "2026-08-01T00:00:00Z" }),
    ).toThrow();
  });

  it("rejeita origin_type inválido no create", () => {
    expect(() =>
      actionPlanCreateSchema.parse({ ...base, originType: "inspection" }),
    ).toThrow();
  });
});

describe("actionPlanUpdateSchema (US6)", () => {
  it("não aceita troca de origem (strict, origem imutável)", () => {
    const { originType: _t, originId: _i, ...content } = base;
    void _t;
    void _i;
    const parsed = actionPlanUpdateSchema.parse(content);
    expect(parsed.what).toBe(base.what);
    expect(() =>
      actionPlanUpdateSchema.parse({ ...content, originType: "incident" }),
    ).toThrow();
    expect(() =>
      actionPlanUpdateSchema.parse({ ...content, status: "completed" }),
    ).toThrow();
  });
});

describe("status transitions do plano (US6)", () => {
  it("planned avança para in_progress/completed/cancelled", () => {
    expect(canTransitionActionPlan("planned", "in_progress")).toBe(true);
    expect(canTransitionActionPlan("planned", "completed")).toBe(true);
    expect(canTransitionActionPlan("planned", "cancelled")).toBe(true);
  });

  it("in_progress só vai a completed/cancelled; terminais não retrocedem", () => {
    expect(canTransitionActionPlan("in_progress", "completed")).toBe(true);
    expect(canTransitionActionPlan("in_progress", "cancelled")).toBe(true);
    expect(canTransitionActionPlan("in_progress", "planned")).toBe(false);
    expect(canTransitionActionPlan("completed", "in_progress")).toBe(false);
    expect(canTransitionActionPlan("cancelled", "planned")).toBe(false);
  });

  it("ativo vs terminal", () => {
    expect(isActionPlanActive("planned")).toBe(true);
    expect(isActionPlanActive("in_progress")).toBe(true);
    expect(isActionPlanActive("completed")).toBe(false);
    expect(isActionPlanActive("cancelled")).toBe(false);
    expect(isActionPlanTerminal("completed")).toBe(true);
    expect(isActionPlanTerminal("cancelled")).toBe(true);
    expect(isActionPlanTerminal("planned")).toBe(false);
  });
});

describe("computeActionPlanOverdue (derivado, US6)", () => {
  it("atrasado quando prazo passou e não terminal", () => {
    expect(computeActionPlanOverdue("2026-07-01", "planned", "2026-07-16")).toBe(true);
    expect(computeActionPlanOverdue("2026-07-01", "in_progress", "2026-07-16")).toBe(
      true,
    );
  });

  it("não atrasado se concluído/cancelado, sem prazo, ou prazo futuro", () => {
    expect(computeActionPlanOverdue("2026-07-01", "completed", "2026-07-16")).toBe(false);
    expect(computeActionPlanOverdue("2026-07-01", "cancelled", "2026-07-16")).toBe(false);
    expect(computeActionPlanOverdue(null, "planned", "2026-07-16")).toBe(false);
    expect(computeActionPlanOverdue("2026-08-01", "planned", "2026-07-16")).toBe(false);
  });
});

describe("filtros e prioridade (US6)", () => {
  it("filtros são strict e validam enums", () => {
    expect(
      actionPlanFiltersSchema.parse({ status: "planned", priority: 3 }).priority,
    ).toBe(3);
    expect(() => actionPlanFiltersSchema.parse({ status: "bogus" })).toThrow();
    expect(() => actionPlanFiltersSchema.parse({ originType: "inspection" })).toThrow();
  });

  it("rótulo de prioridade", () => {
    expect(actionPlanPriorityLabel(1)).toBe("Baixa");
    expect(actionPlanPriorityLabel(2)).toBe("Média");
    expect(actionPlanPriorityLabel(3)).toBe("Alta");
    expect(actionPlanPriorityLabel(null)).toBe("—");
  });

  it("transição de status é strict", () => {
    expect(actionPlanStatusTransitionSchema.parse({ status: "completed" }).status).toBe(
      "completed",
    );
    expect(() =>
      actionPlanStatusTransitionSchema.parse({ status: "completed", extra: 1 }),
    ).toThrow();
  });
});
