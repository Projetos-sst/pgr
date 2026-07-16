import {
  WORK_PERMIT_STATUS_LABELS,
  WORK_PERMIT_TYPE_LABELS,
  toWorkPermitListItem,
  workPermitInputSchema,
  workPermitStatusLabel,
  workPermitTypeLabel,
} from "@/shared/domains/work-permits/work-permits";

describe("workPermitInputSchema", () => {
  it("aceita PT válida; status default draft", () => {
    const parsed = workPermitInputSchema.parse({
      number: "PT-001",
      type: "hot_work",
      description: "Solda em tubulação",
      validFrom: "2026-07-15",
      validUntil: "2026-07-16",
    });
    expect(parsed.status).toBe("draft");
    expect(parsed.companyId).toBeUndefined();
  });

  it("rejeita validade final anterior à inicial", () => {
    expect(() =>
      workPermitInputSchema.parse({
        number: "PT-002",
        type: "height",
        description: "Trabalho em altura",
        validFrom: "2026-07-20",
        validUntil: "2026-07-10",
      }),
    ).toThrow();
  });

  it("aceita validade igual (mesmo dia) e companyId null", () => {
    const parsed = workPermitInputSchema.parse({
      number: "PT-003",
      type: "confined_space",
      description: "Limpeza de tanque",
      validFrom: "2026-07-15",
      validUntil: "2026-07-15",
      companyId: null,
    });
    expect(parsed.validUntil).toBe("2026-07-15");
    expect(parsed.companyId).toBeNull();
  });

  it("rejeita número/descrição vazios e tipo inválido", () => {
    expect(() =>
      workPermitInputSchema.parse({
        number: "  ",
        type: "hot_work",
        description: "x",
        validFrom: "2026-07-15",
        validUntil: "2026-07-16",
      }),
    ).toThrow();
    expect(() =>
      workPermitInputSchema.parse({
        number: "PT",
        type: "invalid",
        description: "x",
        validFrom: "2026-07-15",
        validUntil: "2026-07-16",
      }),
    ).toThrow();
  });
});

describe("labels e projeção", () => {
  it("rótulos de tipo e status", () => {
    expect(workPermitTypeLabel("confined_space")).toBe(
      WORK_PERMIT_TYPE_LABELS.confined_space,
    );
    expect(workPermitTypeLabel("xyz")).toBe("xyz");
    expect(workPermitStatusLabel("active")).toBe(WORK_PERMIT_STATUS_LABELS.active);
  });

  it("projeta linha da listagem", () => {
    expect(
      toWorkPermitListItem({
        id: "w1",
        number: "PT-001",
        type: "hot_work",
        status: "active",
        companyName: "ACME",
        validFrom: "2026-07-15",
        validUntil: "2026-07-16",
      }),
    ).toMatchObject({
      number: "PT-001",
      typeLabel: "Trabalho a quente",
      statusLabel: "Ativa",
    });
  });
});
