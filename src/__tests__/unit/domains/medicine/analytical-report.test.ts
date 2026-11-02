/**
 * Relatório analítico (NOB-154, NR-7 7.6.2 a 7.6.6): período anual a partir do último relatório,
 * simplificação do 7.6.6, contagens sem duplicidade, informação insuficiente ≠ zero, comparação
 * só de indicadores equivalentes e nenhum dado individual. Fictício.
 */
import {
  analyticalReportHash,
  analyticalReportInputSchema,
  composeAnalyticalReport,
  countCats,
  countClinicalExams,
  countProcedures,
  periodIssues,
  simplificationEligibility,
  type AnalyticalReportInput,
} from "@/shared/domains/medicine/analytical-report";

const TODAY = "2026-11-02";

function input(overrides: Partial<AnalyticalReportInput> = {}): AnalyticalReportInput {
  return {
    period: { periodStart: "2025-11-01", periodEnd: "2026-10-31" },
    company: { razaoSocial: "Empresa Fictícia", cnpj: "11222333000181", riskGrade: 3 },
    employees: 40,
    author: { name: "Dra. Coordenadora", registration: "CRM 1/MA" },
    simplified: false,
    clinical: {
      ...countClinicalExams([
        { employeeId: "e1", examType: "periodic", performedAt: "2026-03-01" },
        { employeeId: "e1", examType: "periodic", performedAt: "2026-03-01" },
        { employeeId: "e2", examType: "admissional", performedAt: "2026-04-01" },
      ]),
      unverifiedOrigin: 1,
    },
    complementary: countProcedures([
      { procedureCode: "0281", otherDescription: null },
      { procedureCode: "0281", otherDescription: null },
      { procedureCode: "9999", otherDescription: "Exame fictício" },
    ]),
    cats: countCats([{ type: "typical" }, { type: "occupational_disease" }], 1),
    previous: null,
    variationDiscussion: null,
    insufficiencyNote: null,
    ...overrides,
  };
}

describe("periodIssues", () => {
  it("anual a partir do último relatório; fim não futuro e até 12 meses", () => {
    expect(
      periodIssues({ periodStart: "2025-11-01", periodEnd: "2026-10-31" }, null, TODAY),
    ).toEqual([]);
    expect(
      periodIssues(
        { periodStart: "2025-11-01", periodEnd: "2026-11-01" },
        null,
        TODAY,
      ).map((i) => i.message),
    ).toEqual([expect.stringMatching(/até 2026-10-31/)]);
    expect(
      periodIssues({ periodStart: "2026-01-01", periodEnd: "2026-12-31" }, null, TODAY)[0]
        .message,
    ).toMatch(/futuro/);
    expect(
      periodIssues({ periodStart: "2026-03-01", periodEnd: "2026-02-01" }, null, TODAY)[0]
        .message,
    ).toMatch(/anterior ao início/);
    // Com relatório anterior, o período começa no dia seguinte (não no ano civil).
    expect(
      periodIssues(
        { periodStart: "2026-01-01", periodEnd: "2026-10-31" },
        { periodEnd: "2025-10-31" },
        TODAY,
      ),
    ).toEqual([
      { field: "periodStart", message: expect.stringMatching(/começa em 2025-11-01/) },
    ]);
    expect(
      periodIssues(
        { periodStart: "2025-11-01", periodEnd: "2026-10-31" },
        { periodEnd: "2025-10-31" },
        TODAY,
      ),
    ).toEqual([]);
  });

  it("entrada estrita, com datas ISO", () => {
    const ok = { periodStart: "2025-11-01", periodEnd: "2026-10-31" };
    expect(analyticalReportInputSchema.parse(ok).simplified).toBe(false);
    expect(
      analyticalReportInputSchema.safeParse({ ...ok, periodStart: "01/11/2025" }).success,
    ).toBe(false);
    expect(
      analyticalReportInputSchema.safeParse({ ...ok, abnormalResults: 0 }).success,
    ).toBe(false);
  });
});

describe("simplificationEligibility (7.6.6)", () => {
  it("GR 1–2 até 25; GR 3–4 até 10; sem grau não verificável", () => {
    expect(simplificationEligibility(1, 25).eligible).toBe(true);
    expect(simplificationEligibility(2, 26).eligible).toBe(false);
    expect(simplificationEligibility(3, 10).eligible).toBe(true);
    expect(simplificationEligibility(4, 11).eligible).toBe(false);
    expect(simplificationEligibility(null, 1)).toMatchObject({
      eligible: false,
      basis: expect.stringMatching(/não cadastrado/),
    });
  });
});

describe("contagens", () => {
  it("exames clínicos distintos por funcionário, tipo e data; procedimentos e CAT por tipo", () => {
    expect(input().clinical).toMatchObject({ total: 2, duplicatesIgnored: 1 });
    expect(input().clinical.byType.map((t) => [t.examType, t.count])).toEqual([
      ["admissional", 1],
      ["periodic", 1],
    ]);
    expect(input().complementary).toEqual({
      total: 3,
      byProcedure: [
        { procedureCode: "0281", description: "Audiometria tonal ocupacional", count: 2 },
        { procedureCode: "9999", description: "Exame fictício", count: 1 },
      ],
    });
    expect(input().cats).toMatchObject({ total: 2, withoutIssueDate: 1 });
  });
});

describe("composeAnalyticalReport", () => {
  it("c e d: informação insuficiente, nunca zero; dispensa do 7.7.4 não presumida", () => {
    const content = composeAnalyticalReport(input());
    expect(content.items.c).toMatchObject({ status: "insufficient" });
    expect(content.items.d).toMatchObject({ status: "insufficient" });
    expect(JSON.stringify(content.items.c)).not.toMatch(/"total"|"count"/);
    expect(content.items.e).toMatchObject({ status: "registered_only", total: 2 });
    expect(content.items.f).toMatchObject({ status: "no_previous" });
    expect(content.exemption).toMatchObject({ status: "not_verifiable" });
    expect(content.transferredRecords.status).toBe("not_recorded");
    expect(content.presentation.status).toBe("pending");
    expect(content.status).toBe("preview");
    expect(JSON.stringify(content)).not.toMatch(/e1|e2/);
  });

  it("simplificado (7.6.6): só a e b; c a f não exigidas", () => {
    const content = composeAnalyticalReport(input({ simplified: true }));
    for (const key of ["c", "d", "e", "f"] as const)
      expect(content.items[key]).toMatchObject({ status: "not_required" });
    expect(content.items.a.status).toBe("available");
  });

  it("f: compara indicadores equivalentes e guarda a discussão do coordenador", () => {
    const previous = composeAnalyticalReport(
      input({
        period: { periodStart: "2024-11-01", periodEnd: "2025-10-31" },
        clinical: {
          ...countClinicalExams([
            { employeeId: "e3", examType: "periodic", performedAt: "2025-03-01" },
          ]),
          unverifiedOrigin: 0,
        },
        cats: countCats([], 0),
      }),
    );
    const content = composeAnalyticalReport(
      input({
        previous: {
          id: "r1",
          version: 1,
          periodStart: "2024-11-01",
          periodEnd: "2025-10-31",
          content: previous,
        },
        variationDiscussion: "Discussão fictícia escrita pela coordenadora.",
      }),
    );
    expect(content.items.f.status).toBe("compared");
    if (content.items.f.status !== "compared") throw new Error();
    expect(content.items.f.comparisons).toEqual(
      expect.arrayContaining([
        {
          indicator: "Exames clínicos realizados",
          previous: 1,
          current: 2,
          difference: 1,
        },
        { indicator: "CAT registradas", previous: 0, current: 2, difference: 2 },
      ]),
    );
    expect(content.items.f.discussion).toBe(
      "Discussão fictícia escrita pela coordenadora.",
    );
    expect(content.period.basis).toMatch(/versão 1/);
    // Relatório anterior simplificado: CAT não é comparável.
    const simplifiedPrevious = composeAnalyticalReport(
      input({
        period: { periodStart: "2024-11-01", periodEnd: "2025-10-31" },
        simplified: true,
      }),
    );
    const vsSimplified = composeAnalyticalReport(
      input({
        previous: {
          id: "r1",
          version: 1,
          periodStart: "2024-11-01",
          periodEnd: "2025-10-31",
          content: simplifiedPrevious,
        },
        variationDiscussion: "Texto.",
      }),
    );
    if (vsSimplified.items.f.status !== "compared") throw new Error();
    expect(vsSimplified.items.f.comparisons.map((c) => c.indicator)).not.toContain(
      "CAT registradas",
    );
  });

  it("hash estável e sensível ao conteúdo", () => {
    const content = composeAnalyticalReport(input());
    expect(analyticalReportHash(content)).toBe(
      analyticalReportHash(JSON.parse(JSON.stringify(content))),
    );
    expect(
      analyticalReportHash(composeAnalyticalReport(input({ employees: 41 }))),
    ).not.toBe(analyticalReportHash(content));
  });
});
