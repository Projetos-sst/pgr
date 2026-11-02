/**
 * Composição do PCMSO (NOB-151): só exames mantidos no plano aprovado, riscos com agravos por
 * grupo, vigência de 12 meses, aviso de prévia, seções pendentes e hash estável. Fictício.
 */
import {
  composePcmso,
  pcmsoContentHash,
  pcmsoGenerationSchema,
  stableStringify,
  type PcmsoCompositionInput,
} from "@/shared/domains/medicine/pcmso-composition";

function input(overrides: Partial<PcmsoCompositionInput> = {}): PcmsoCompositionInput {
  return {
    cycleStart: "2026-11-01",
    company: {
      razaoSocial: "Empresa Fictícia",
      cnpj: "11222333000181",
      cnae: "4120-4",
      mainActivity: "Construção",
      riskGrade: 3,
      activeEmployees: 10,
    },
    coordinator: {
      name: "Dra. Fictícia",
      crm: "123",
      registrationUf: "MA",
      rqe: "456",
      rqeExceptionReason: null,
      startsOn: "2026-01-01",
    },
    riskSources: [{ id: "s1", kind: "internal", title: "PGR", version: "Revisão 1" }],
    risks: [
      {
        exposureGroup: "Produção",
        jobRole: "",
        description: "Ruído",
        agentType: "physical",
        possibleInjuries: "PAIR",
      },
      {
        exposureGroup: "Administrativo",
        jobRole: "",
        description: "Postura",
        agentType: "ergonomic",
        possibleInjuries: null,
      },
    ],
    plan: {
      id: "p1",
      version: 2,
      approvedAt: "2026-10-30T12:00:00.000Z",
      approvedByName: "Dra. Fictícia",
      items: [
        {
          exposureGroup: "Produção",
          jobRole: "",
          procedureCode: "0281",
          otherDescription: null,
          decision: "kept",
          periodicity: "Anual",
          origin: "suggested",
        },
        {
          exposureGroup: "Produção",
          jobRole: "",
          procedureCode: "1057",
          otherDescription: null,
          decision: "removed",
          periodicity: "Bienal",
          origin: "suggested",
        },
        {
          exposureGroup: "Produção",
          jobRole: "",
          procedureCode: "9999",
          otherDescription: "Exame fictício",
          decision: "kept",
          periodicity: "Semestral",
          origin: "added",
        },
      ],
    },
    examiners: [{ name: "Dr. Examinador", registration: "CRM 789/MA" }],
    interpretationCriteria: [],
    analyticalReport: null,
    pendingSections: [
      {
        code: "clinics",
        severity: "not_available",
        message: "Clínicas ainda sem cadastro.",
        reference: "MED-08",
        href: null,
      },
    ],
    ...overrides,
  };
}

describe("composePcmso", () => {
  it("só exames mantidos; 9999 usa a descrição; grupos com riscos e agravos", () => {
    const content = composePcmso(input());
    const production = content.groups.find((g) => g.exposureGroup === "Produção")!;
    expect(production.exams.map((e) => [e.procedureCode, e.description])).toEqual([
      ["0281", "Audiometria tonal ocupacional"],
      ["9999", "Exame fictício"],
    ]);
    expect(production.risks).toEqual([
      { description: "Ruído", agentType: "physical", possibleInjuries: "PAIR" },
    ]);
    const admin = content.groups.find((g) => g.exposureGroup === "Administrativo")!;
    expect(admin.exams).toEqual([]);
  });

  it("vigência de 12 meses a partir da data-base, aviso de prévia e seções pendentes", () => {
    const content = composePcmso(input());
    expect(content.planningCycle).toMatchObject({
      start: "2026-11-01",
      end: "2027-10-31",
    });
    expect(content.status).toBe("preview");
    expect(content.notice).toMatch(/PRÉVIA/);
    expect(content.pendingSections).toEqual([
      { code: "clinics", message: "Clínicas ainda sem cadastro.", reference: "MED-08" },
    ]);
    expect(composePcmso(input({ cycleStart: "2028-02-29" })).planningCycle.end).toBe(
      "2029-02-27",
    );
  });

  it("hash estável independe da ordem das chaves e muda com o conteúdo", () => {
    expect(stableStringify({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(
      '{"a":[2,{"c":4,"d":3}],"b":1}',
    );
    const content = composePcmso(input());
    expect(pcmsoContentHash(content)).toBe(
      pcmsoContentHash(JSON.parse(JSON.stringify(content))),
    );
    expect(pcmsoContentHash(composePcmso(input({ cycleStart: "2026-12-01" })))).not.toBe(
      pcmsoContentHash(content),
    );
    expect(pcmsoContentHash(content)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("ciclo, revisão e relatório analítico", () => {
  it("ciclo de 12 meses não é validade normativa; revisão pelo PGR; relatório anual pendente", () => {
    const content = composePcmso(input());
    expect(content.planningCycle.basis).toMatch(/Não é prazo de validade normativo/);
    expect(content.revision.triggers.join(" ")).toMatch(/7\.5\.1/);
    expect(content.revision.administrativeUpdate).toMatch(/não revisão/);
    expect(content.analyticalReport).toMatchObject({ status: "pending" });
    expect(content.analyticalReport.frequency).toMatch(/7\.6\.2/);
    expect(content).not.toHaveProperty("validity");
  });
});

describe("critérios de interpretação (NOB-153)", () => {
  it("cada exame mantido traz o critério do coordenador ou fica pendente; retirados não entram", () => {
    const content = composePcmso(
      input({
        interpretationCriteria: [
          {
            id: "k1",
            procedureCode: "0281",
            otherDescription: null,
            version: 3,
            criteria: "Critério fictício.",
            conduct: "Conduta fictícia.",
            authorName: "Dra. Fictícia",
            authoredAt: "2026-11-01T10:00:00.000Z",
          },
        ],
      }),
    );
    expect(content.schemaVersion).toBe(3);
    expect(content.interpretation.reference).toBe("NR-7 7.5.4 c");
    expect(content.interpretation.authorship).toMatch(/não gera nem sugere/);
    expect(content.interpretation.items).toEqual([
      expect.objectContaining({
        procedureCode: "0281",
        status: "defined",
        criteria: "Critério fictício.",
        conduct: "Conduta fictícia.",
        author: "Dra. Fictícia",
        version: 3,
      }),
      expect.objectContaining({
        procedureCode: "9999",
        description: "Exame fictício",
        status: "pending",
      }),
    ]);
    expect(content.interpretation.items.map((i) => i.procedureCode)).not.toContain(
      "1057",
    );
  });
});

describe("relatório analítico na composição (NOB-154)", () => {
  it("referencia o último relatório arquivado ou fica pendente", () => {
    expect(composePcmso(input()).analyticalReport).toMatchObject({ status: "pending" });
    const withReport = composePcmso(
      input({
        analyticalReport: {
          id: "r1",
          version: 2,
          periodStart: "2025-11-01",
          periodEnd: "2026-10-31",
          contentSha256: "c".repeat(64),
        },
      }),
    );
    expect(withReport.analyticalReport).toMatchObject({
      status: "available",
      reportId: "r1",
      version: 2,
      periodStart: "2025-11-01",
      periodEnd: "2026-10-31",
    });
  });
});

describe("pcmsoGenerationSchema", () => {
  it("exige data-base ISO válida", () => {
    expect(pcmsoGenerationSchema.safeParse({ cycleStart: "2026-11-01" }).success).toBe(
      true,
    );
    expect(pcmsoGenerationSchema.safeParse({ cycleStart: "01/11/2026" }).success).toBe(
      false,
    );
    expect(pcmsoGenerationSchema.safeParse({ cycleStart: "2026-13-40" }).success).toBe(
      false,
    );
    expect(
      pcmsoGenerationSchema.safeParse({ cycleStart: "2026-11-01", status: "issued" })
        .success,
    ).toBe(false);
  });
});
