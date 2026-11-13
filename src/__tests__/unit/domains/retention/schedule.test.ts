import {
  PROPOSED_RETENTION_TERMS,
  type RetentionPolicyState,
} from "@/shared/domains/retention/policy";
import {
  computeRetentionSchedule,
  discardGate,
  discardGateLabel,
  retentionMarkersSchema,
} from "@/shared/domains/retention/schedule";

const approved: RetentionPolicyState = {
  status: "approved",
  version: 1,
  termsSha256: "b".repeat(64),
};
const notApproved: RetentionPolicyState = {
  status: "not_approved",
  reason: "no_policy",
};
const terms = {
  ...PROPOSED_RETENTION_TERMS,
  categories: [
    {
      category: "pgr_documents" as const,
      retentionMonths: 12,
      startingPoint: "contract_end" as const,
    },
    {
      category: "health_records" as const,
      retentionMonths: 240,
      startingPoint: "employee_termination" as const,
    },
  ],
};

describe("cálculo das datas de guarda", () => {
  it("soma o prazo ao marco inicial e calcula os avisos de 90, 60 e 30 dias", () => {
    const [pgrRow] = computeRetentionSchedule(terms, { contract_end: "2027-01-31" });
    expect(pgrRow).toEqual({
      category: "pgr_documents",
      startingPoint: "contract_end",
      retentionMonths: 12,
      startedOn: "2027-01-31",
      eligibleOn: "2028-01-31",
      notices: [
        { daysBefore: 90, on: "2027-11-02" },
        { daysBefore: 60, on: "2027-12-02" },
        { daysBefore: 30, on: "2028-01-01" },
      ],
    });
  });

  it("dia inexistente no mês de destino cai no último dia do mês", () => {
    const [row] = computeRetentionSchedule(
      { ...terms, categories: [{ ...terms.categories[0], retentionMonths: 1 }] },
      { contract_end: "2027-01-31" },
    );
    expect(row.eligibleOn).toBe("2027-02-28");
  });

  it("os prazos vêm da política: mudar o prazo e os avisos muda o resultado", () => {
    const [row] = computeRetentionSchedule(
      {
        ...terms,
        noticeDaysBefore: [10],
        categories: [{ ...terms.categories[0], retentionMonths: 24 }],
      },
      { contract_end: "2027-01-31" },
    );
    expect(row.eligibleOn).toBe("2029-01-31");
    expect(row.notices).toEqual([{ daysBefore: 10, on: "2029-01-21" }]);
  });

  it("sem o marco inicial informado não inventa data", () => {
    const rows = computeRetentionSchedule(terms, { contract_end: "2027-01-31" });
    expect(rows[1]).toEqual({
      category: "health_records",
      startingPoint: "employee_termination",
      retentionMonths: 240,
      startedOn: null,
      eligibleOn: null,
      notices: [],
    });
  });
});

describe("trava de descarte", () => {
  const [row] = computeRetentionSchedule(terms, { contract_end: "2027-01-31" });

  it("recusa qualquer descarte sem política aprovada, mesmo com prazo vencido", () => {
    expect(discardGate(notApproved, row, "2040-01-01")).toEqual({
      allowed: false,
      reason: "policy_not_approved",
    });
  });

  it("recusa quando a versão mais recente é só proposta", () => {
    expect(
      discardGate(
        { status: "not_approved", reason: "latest_version_proposed" },
        row,
        "2040-01-01",
      ),
    ).toEqual({ allowed: false, reason: "policy_not_approved" });
  });

  it("com política aprovada, recusa enquanto o prazo de guarda corre", () => {
    expect(discardGate(approved, row, "2028-01-30")).toEqual({
      allowed: false,
      reason: "retention_period_running",
    });
  });

  it("com política aprovada, recusa quando o marco inicial é desconhecido", () => {
    const [, health] = computeRetentionSchedule(terms, { contract_end: "2027-01-31" });
    expect(discardGate(approved, health, "2099-01-01")).toEqual({
      allowed: false,
      reason: "starting_point_unknown",
    });
  });

  it("só libera com política aprovada e prazo cumprido", () => {
    expect(discardGate(approved, row, "2028-01-31")).toEqual({ allowed: true });
  });
});

describe("marcos e rótulos da simulação", () => {
  it("aceita marco vazio como não informado e recusa data fora do padrão", () => {
    expect(
      retentionMarkersSchema.parse({ contract_end: "2027-01-31", company_closure: "" }),
    ).toEqual({ contract_end: "2027-01-31" });
    expect(retentionMarkersSchema.safeParse({ contract_end: "31/01/2027" }).success).toBe(
      false,
    );
  });

  it("explica por que o descarte está bloqueado", () => {
    expect(discardGateLabel({ allowed: false, reason: "policy_not_approved" })).toContain(
      "não há política de guarda aprovada",
    );
    expect(discardGateLabel({ allowed: true })).toContain("continua manual");
  });
});
