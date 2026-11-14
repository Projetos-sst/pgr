import {
  PROPOSED_RETENTION_TERMS,
  RETENTION_CATEGORIES,
  RETENTION_CATEGORY_CATALOG,
  retentionPolicyState,
  retentionPolicyStateLabel,
  retentionPolicyVersionSchema,
  retentionTermsSha256,
} from "@/shared/domains/retention/policy";

const approval = {
  approverName: "Maria Responsável",
  approverRole: "Sócia administradora",
  approvedOn: "2026-11-10",
  reference: "Ata de 10/11/2026, cláusula 8 do contrato",
};

describe("política de guarda: validação da versão", () => {
  it("aceita a proposta da SEG-12 como versão proposta, sem aprovação", () => {
    const parsed = retentionPolicyVersionSchema.parse({
      status: "proposed",
      terms: PROPOSED_RETENTION_TERMS,
    });
    expect(parsed.status).toBe("proposed");
    expect(parsed.terms.noticeDaysBefore).toEqual([90, 60, 30]);
    expect(parsed.terms.categories.map((row) => row.category)).toEqual([
      ...RETENTION_CATEGORIES,
    ]);
  });

  it("exige quem aprovou, cargo, data e referência quando a versão é aprovada", () => {
    const result = retentionPolicyVersionSchema.safeParse({
      status: "approved",
      terms: PROPOSED_RETENTION_TERMS,
      approval: { ...approval, approverName: " ", reference: "" },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["approval.approverName", "approval.reference"]),
    );
  });

  it("recusa aprovação sem o bloco de aprovação", () => {
    expect(
      retentionPolicyVersionSchema.safeParse({
        status: "approved",
        terms: PROPOSED_RETENTION_TERMS,
      }).success,
    ).toBe(false);
  });

  it("recusa política que deixa categoria de fora ou repete categoria", () => {
    const [first, ...rest] = PROPOSED_RETENTION_TERMS.categories;
    const missing = { ...PROPOSED_RETENTION_TERMS, categories: rest };
    const repeated = {
      ...PROPOSED_RETENTION_TERMS,
      categories: [first, first, ...rest.slice(1)],
    };
    expect(
      retentionPolicyVersionSchema.safeParse({ status: "proposed", terms: missing })
        .success,
    ).toBe(false);
    expect(
      retentionPolicyVersionSchema.safeParse({ status: "proposed", terms: repeated })
        .success,
    ).toBe(false);
  });

  it("recusa prazo zero, aviso repetido e marco inicial desconhecido", () => {
    const [first, ...rest] = PROPOSED_RETENTION_TERMS.categories;
    const invalid = [
      { categories: [{ ...first, retentionMonths: 0 }, ...rest] },
      { noticeDaysBefore: [30, 30] },
      { noticeDaysBefore: [] },
      { categories: [{ ...first, startingPoint: "sale_of_company" }, ...rest] },
    ];
    for (const change of invalid) {
      expect(
        retentionPolicyVersionSchema.safeParse({
          status: "proposed",
          terms: { ...PROPOSED_RETENTION_TERMS, ...change },
        }).success,
      ).toBe(false);
    }
  });

  it("normaliza a ordem: o mesmo conteúdo gera o mesmo hash dos termos", () => {
    const shuffled = retentionPolicyVersionSchema.parse({
      status: "proposed",
      terms: {
        ...PROPOSED_RETENTION_TERMS,
        categories: [...PROPOSED_RETENTION_TERMS.categories].reverse(),
        noticeDaysBefore: [30, 90, 60],
      },
    });
    const ordered = retentionPolicyVersionSchema.parse({
      status: "proposed",
      terms: PROPOSED_RETENTION_TERMS,
    });
    expect(retentionTermsSha256(shuffled.terms)).toBe(
      retentionTermsSha256(ordered.terms),
    );
    expect(retentionTermsSha256(ordered.terms)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("toda categoria lista os registros que abrange", () => {
    for (const category of RETENTION_CATEGORIES) {
      expect(RETENTION_CATEGORY_CATALOG[category].records.length).toBeGreaterThan(0);
      expect(RETENTION_CATEGORY_CATALOG[category].label).not.toBe("");
    }
  });
});

describe("política de guarda: estado", () => {
  const version = { version: 2, termsSha256: "a".repeat(64) };

  it("sem versão registrada o estado é não aprovada", () => {
    expect(retentionPolicyState(null)).toEqual({
      status: "not_approved",
      reason: "no_policy",
    });
  });

  it("versão mais recente apenas proposta mantém o estado não aprovada", () => {
    expect(retentionPolicyState({ ...version, status: "proposed" })).toEqual({
      status: "not_approved",
      reason: "latest_version_proposed",
    });
  });

  it("versão mais recente aprovada vira o estado aprovada, com versão e hash", () => {
    expect(retentionPolicyState({ ...version, status: "approved" })).toEqual({
      status: "approved",
      ...version,
    });
  });

  it("o rótulo deixa claro quando a política não está aprovada", () => {
    expect(retentionPolicyStateLabel(retentionPolicyState(null))).toContain(
      "Não aprovada",
    );
    expect(
      retentionPolicyStateLabel(retentionPolicyState({ ...version, status: "approved" })),
    ).toBe("Aprovada (versão 2)");
  });
});
