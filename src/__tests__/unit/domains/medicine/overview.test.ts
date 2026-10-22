import {
  EXAM_VALIDITY_LABELS,
  summarizeMedicineOverview,
  type MedicineOverviewData,
} from "@/shared/domains/medicine/overview";

// Hoje fixo: hoje+30 = 2026-09-01; hoje+31 = 2026-09-02.
const OPTS = { today: "2026-08-02", dueWindowDays: 30 };

const C1 = "c1";
const C2 = "c2";

function oneCompany(
  latestExams: MedicineOverviewData["latestExams"],
  employeeCount = latestExams.length,
): MedicineOverviewData {
  return {
    companies: [{ id: C1, razaoSocial: "EXEMPLO Empresa 1" }],
    employeeCounts: [{ companyId: C1, count: employeeCount }],
    latestExams,
  };
}

describe("summarizeMedicineOverview — classificação do último exame", () => {
  it("validUntil nulo → noExpiry", () => {
    const result = summarizeMedicineOverview(
      oneCompany([{ companyId: C1, validUntil: null }]),
      OPTS,
    );
    expect(result.companies[0].validity).toEqual({
      ok: 0,
      dueSoon: 0,
      expired: 0,
      noExpiry: 1,
      withoutExam: 0,
    });
  });

  it("ontem → expired", () => {
    const result = summarizeMedicineOverview(
      oneCompany([{ companyId: C1, validUntil: "2026-08-01" }]),
      OPTS,
    );
    expect(result.companies[0].validity.expired).toBe(1);
  });

  it("hoje → dueSoon (fronteira inclusiva)", () => {
    const result = summarizeMedicineOverview(
      oneCompany([{ companyId: C1, validUntil: "2026-08-02" }]),
      OPTS,
    );
    expect(result.companies[0].validity.dueSoon).toBe(1);
    expect(result.companies[0].validity.expired).toBe(0);
  });

  it("hoje+30 → dueSoon (fronteira inclusiva da janela)", () => {
    const result = summarizeMedicineOverview(
      oneCompany([{ companyId: C1, validUntil: "2026-09-01" }]),
      OPTS,
    );
    expect(result.companies[0].validity.dueSoon).toBe(1);
  });

  it("hoje+31 → ok", () => {
    const result = summarizeMedicineOverview(
      oneCompany([{ companyId: C1, validUntil: "2026-09-02" }]),
      OPTS,
    );
    expect(result.companies[0].validity.ok).toBe(1);
    expect(result.companies[0].validity.dueSoon).toBe(0);
  });
});

describe("summarizeMedicineOverview — funcionários sem exame e empresas", () => {
  it("funcionário sem exame → withoutExam", () => {
    const result = summarizeMedicineOverview(
      oneCompany([{ companyId: C1, validUntil: "2030-01-01" }], 3),
      OPTS,
    );
    expect(result.companies[0].employeeCount).toBe(3);
    expect(result.companies[0].validity.ok).toBe(1);
    expect(result.companies[0].validity.withoutExam).toBe(2);
  });

  it("withoutExam nunca é negativo (mais exames que funcionários contados)", () => {
    const result = summarizeMedicineOverview(
      oneCompany(
        [
          { companyId: C1, validUntil: null },
          { companyId: C1, validUntil: "2030-01-01" },
        ],
        1,
      ),
      OPTS,
    );
    expect(result.companies[0].validity.withoutExam).toBe(0);
    expect(result.totals.withoutExam).toBe(0);
  });

  it("empresa sem funcionários aparece com zeros", () => {
    const result = summarizeMedicineOverview(
      {
        companies: [{ id: C1, razaoSocial: "EXEMPLO Vazia" }],
        employeeCounts: [],
        latestExams: [],
      },
      OPTS,
    );
    expect(result.companies).toEqual([
      {
        companyId: C1,
        companyName: "EXEMPLO Vazia",
        employeeCount: 0,
        validity: { ok: 0, dueSoon: 0, expired: 0, noExpiry: 0, withoutExam: 0 },
      },
    ]);
  });

  it("nenhuma empresa → lista vazia e totais zerados (não erro)", () => {
    const result = summarizeMedicineOverview(
      { companies: [], employeeCounts: [], latestExams: [] },
      OPTS,
    );
    expect(result.companies).toEqual([]);
    expect(result.totals).toEqual({
      companies: 0,
      employees: 0,
      ok: 0,
      dueSoon: 0,
      expired: 0,
      noExpiry: 0,
      withoutExam: 0,
    });
  });

  it("exame/contagem de empresa fora da lista (sem Medicina) é ignorado", () => {
    const result = summarizeMedicineOverview(
      {
        companies: [{ id: C1, razaoSocial: "EXEMPLO Com Medicina" }],
        employeeCounts: [
          { companyId: C1, count: 1 },
          { companyId: "fora", count: 5 },
        ],
        latestExams: [
          { companyId: C1, validUntil: null },
          { companyId: "fora", validUntil: "2020-01-01" },
        ],
      },
      OPTS,
    );
    expect(result.companies).toHaveLength(1);
    expect(result.totals.employees).toBe(1);
    expect(result.totals.expired).toBe(0);
    expect(result.totals.noExpiry).toBe(1);
  });

  it("totais = soma das empresas", () => {
    const result = summarizeMedicineOverview(
      {
        companies: [
          { id: C1, razaoSocial: "EXEMPLO Um" },
          { id: C2, razaoSocial: "EXEMPLO Dois" },
        ],
        employeeCounts: [
          { companyId: C1, count: 4 },
          { companyId: C2, count: 3 },
        ],
        latestExams: [
          { companyId: C1, validUntil: "2026-08-01" }, // expired
          { companyId: C1, validUntil: "2026-08-10" }, // dueSoon
          { companyId: C1, validUntil: null }, // noExpiry
          { companyId: C2, validUntil: "2030-01-01" }, // ok
          { companyId: C2, validUntil: "2030-01-01" }, // ok
        ],
      },
      OPTS,
    );
    const sum = (key: "ok" | "dueSoon" | "expired" | "noExpiry" | "withoutExam") =>
      result.companies.reduce((acc, c) => acc + c.validity[key], 0);

    expect(result.totals).toEqual({
      companies: 2,
      employees: 7,
      ok: sum("ok"),
      dueSoon: sum("dueSoon"),
      expired: sum("expired"),
      noExpiry: sum("noExpiry"),
      withoutExam: sum("withoutExam"),
    });
    expect(result.totals).toMatchObject({
      ok: 2,
      dueSoon: 1,
      expired: 1,
      noExpiry: 1,
      withoutExam: 2,
    });
  });

  it("ordena as empresas por razão social (pt-BR, acentos)", () => {
    const result = summarizeMedicineOverview(
      {
        companies: [
          { id: "z", razaoSocial: "Zeta Ltda" },
          { id: "a", razaoSocial: "Árvore Ltda" },
          { id: "b", razaoSocial: "Beta Ltda" },
        ],
        employeeCounts: [],
        latestExams: [],
      },
      OPTS,
    );
    expect(result.companies.map((c) => c.companyName)).toEqual([
      "Árvore Ltda",
      "Beta Ltda",
      "Zeta Ltda",
    ]);
  });

  it("devolve today/dueWindowDays recebidos", () => {
    const result = summarizeMedicineOverview(
      { companies: [], employeeCounts: [], latestExams: [] },
      OPTS,
    );
    expect(result.today).toBe("2026-08-02");
    expect(result.dueWindowDays).toBe(30);
  });
});

describe("EXAM_VALIDITY_LABELS", () => {
  it("rótulos da validade informada", () => {
    expect(EXAM_VALIDITY_LABELS).toEqual({
      ok: "Vigente",
      due_soon: "A vencer",
      expired: "Vencido",
      no_expiry: "Sem validade informada",
    });
  });
});
