/**
 * ASO (NOB-152): riscos do GES/função, conferência da NR-7 7.5.19.1 (bloqueios e avisos),
 * composição só com dados cadastrados, sem observações clínicas, e hash estável. Fictício.
 */
import {
  asoChecklist,
  asoContentHash,
  asoReadiness,
  composeAso,
  employeeRisks,
  examProcedureInputSchema,
  type AsoFacts,
  type AsoRiskSource,
} from "@/shared/domains/medicine/aso";
import { RISK_ABSENCE_STATEMENT } from "@/shared/domains/medicine/risk-absence";

const employee = { gesId: "g1", gesName: "Produção", jobRole: "Soldador" };

function source(overrides: Partial<AsoRiskSource> = {}): AsoRiskSource {
  return {
    freshness: "current",
    superseded: false,
    risks: [
      {
        status: "validated",
        content: {
          exposureGroup: "Produção",
          description: "Ruído",
          agentType: "physical",
          originGesId: "g1",
        },
      },
    ],
    ...overrides,
  };
}

function facts(overrides: Partial<AsoFacts> = {}): AsoFacts {
  return {
    exam: {
      examType: "periodic",
      performedAt: "2026-10-20",
      aptitude: "fit",
      companyId: "c1",
    },
    examinerConclusion: null,
    employee: {
      fullName: "Pessoa Fictícia",
      cpf: "00000000191",
      companyId: "c1",
      jobRole: "Soldador",
      gesId: "g1",
      gesName: "Produção",
    },
    company: { razaoSocial: "Empresa Fictícia", cnpj: "11222333000181" },
    examiner: {
      name: "Dr. Examinador",
      profession: "physician",
      registration: "CRM 1/MA",
      registrationUf: "MA",
    },
    coordinator: { name: "Dra. Coordenadora", registration: "CRM 2/MA", rqe: "3" },
    risks: {
      validated: [{ description: "Ruído", agentType: "physical" }],
      pending: 0,
      usableSources: 1,
    },
    procedures: [
      { procedureCode: "0281", otherDescription: null, performedAt: "2026-10-18" },
    ],
    plannedProcedures: [{ procedureCode: "0281", otherDescription: null }],
    riskAbsence: null,
    ...overrides,
  };
}

const blocking = (f: AsoFacts) =>
  asoReadiness(f)
    .filter((i) => i.severity === "blocking")
    .map((i) => i.code);

describe("employeeRisks", () => {
  it("fonte interna casa pelo GES de origem; externa, pelo nome do grupo e da função", () => {
    const external = source({
      freshness: "external_reference",
      risks: [
        {
          status: "validated",
          content: {
            exposureGroup: " produção ",
            jobRole: "Soldador",
            description: "Fumos",
            agentType: "chemical",
          },
        },
        {
          status: "validated",
          content: {
            exposureGroup: "Produção",
            jobRole: "Pintor",
            description: "Solvente",
            agentType: "chemical",
          },
        },
      ],
    });
    const result = employeeRisks([source(), external], employee);
    expect(result.validated.map((r) => r.description)).toEqual(["Ruído", "Fumos"]);
    expect(result).toMatchObject({ pending: 0, usableSources: 2 });
  });

  it("pendentes contam à parte; rejeitados e fontes substituídas não entram; sem duplicar", () => {
    const result = employeeRisks(
      [
        source({
          risks: [
            {
              status: "pending",
              content: {
                exposureGroup: "Produção",
                description: "Calor",
                agentType: "physical",
                originGesId: "g1",
              },
            },
            {
              status: "rejected",
              content: {
                exposureGroup: "Produção",
                description: "Frio",
                agentType: "physical",
                originGesId: "g1",
              },
            },
            {
              status: "validated",
              content: {
                exposureGroup: "Produção",
                description: "Ruído",
                agentType: "physical",
                originGesId: "g1",
              },
            },
            {
              status: "validated",
              content: {
                exposureGroup: "Produção",
                description: "ruído ",
                agentType: "physical",
                originGesId: "g1",
              },
            },
          ],
        }),
        source({ superseded: true }),
      ],
      employee,
    );
    expect(result.validated).toEqual([{ description: "Ruído", agentType: "physical" }]);
    expect(result.pending).toBe(1);
  });

  it("outro GES não se aplica; fonte com PGR alterado não vale", () => {
    expect(employeeRisks([source()], { ...employee, gesId: "g2" }).validated).toEqual([]);
    expect(employeeRisks([source({ freshness: "changed" })], employee)).toMatchObject({
      validated: [],
      usableSources: 0,
    });
  });
});

describe("asoReadiness", () => {
  it("dados completos: sem bloqueio; assinatura indisponível sempre avisa", () => {
    const items = asoReadiness(facts());
    expect(items.filter((i) => i.severity === "blocking")).toEqual([]);
    expect(items.map((i) => i.code)).toEqual(["signature_unavailable"]);
    expect(asoChecklist(items).map((c) => c.status)).toEqual([
      "ok",
      "ok",
      "ok",
      "ok",
      "ok",
      "ok",
      "warning",
    ]);
  });

  it("dados incompletos bloqueiam os itens a, b, e e g", () => {
    expect(
      blocking(
        facts({
          company: { razaoSocial: "Empresa", cnpj: null },
          employee: { ...facts().employee, jobRole: null },
          examiner: null,
        }),
      ),
    ).toEqual(["company_document", "employee_job_role", "examiner_missing"]);
    expect(
      blocking(
        facts({
          examiner: {
            name: "P",
            profession: "psychologist",
            registration: "CRP 1",
            registrationUf: null,
          },
        }),
      ),
    ).toEqual(["examiner_not_physician", "examiner_registration"]);
  });

  it("riscos: pendentes, sem fonte e ausência não declarada são casos distintos", () => {
    expect(
      blocking(facts({ risks: { validated: [], pending: 2, usableSources: 0 } })),
    ).toEqual(["risks_pending"]);
    expect(
      blocking(facts({ risks: { validated: [], pending: 0, usableSources: 0 } })),
    ).toEqual(["risk_source"]);
    expect(
      blocking(facts({ risks: { validated: [], pending: 0, usableSources: 1 } })),
    ).toEqual(["risks_absence_not_declared"]);
    expect(blocking(facts({ employee: { ...facts().employee, gesId: null } }))).toEqual([
      "employee_ges",
    ]);
  });

  it("NOB-156: declaração vigente de inexistência libera o item c; pendentes continuam bloqueando", () => {
    const riskAbsence = {
      declarationId: "d1",
      source: { id: "s1", title: "PGR Fictício", version: "3" },
      exposureGroup: "Produção",
      jobRole: "",
      declaredByName: "Profissional Fictícia",
      declaredAt: "2026-10-01T10:00:00.000Z",
    };
    const declared = facts({
      risks: { validated: [], pending: 0, usableSources: 0 },
      riskAbsence,
    });
    expect(blocking(declared)).toEqual([]);
    expect(composeAso(declared).risks).toEqual([]);
    expect(composeAso(declared).risksAbsence).toMatchObject({
      statement: RISK_ABSENCE_STATEMENT,
      source: { title: "PGR Fictício", version: "3" },
      jobRole: null,
      declaredBy: "Profissional Fictícia",
    });
    expect(
      blocking(
        facts({ risks: { validated: [], pending: 1, usableSources: 1 }, riskAbsence }),
      ),
    ).toEqual(["risks_pending"]);
    // Com riscos validados, a declaração não substitui os riscos: aviso de conflito.
    const conflict = facts({ riskAbsence });
    expect(blocking(conflict)).toEqual([]);
    expect(composeAso(conflict).risksAbsence).toBeNull();
    expect(composeAso(conflict).warnings.map((w) => w.code)).toContain(
      "risk_absence_conflict",
    );
    expect(composeAso(facts()).risksAbsence).toBeNull();
  });

  it("NOB-112: declaração com função que não é a do funcionário não libera e é explicada", () => {
    const noRisks = { validated: [], pending: 0, usableSources: 1 };
    const mismatch = facts({
      risks: noRisks,
      riskAbsenceUnmatchedJobRoles: ["Op. soldador"],
    });
    expect(blocking(mismatch)).toEqual(["risks_absence_not_declared"]);
    const item = asoReadiness(mismatch).find(
      (i) => i.code === "risks_absence_not_declared",
    );
    expect(item?.message).toMatch(/"Op\. soldador"/);
    expect(item?.message).toMatch(/\("Soldador"\): ela não vale/);
    // Sem divergência, a mensagem é a de sempre.
    const plain = asoReadiness(facts({ risks: noRisks })).find(
      (i) => i.code === "risks_absence_not_declared",
    );
    expect(plain?.message).not.toMatch(/não é exatamente a função/);
  });

  it("NOB-112: declaração antiga só com texto e função desvinculada do GES bloqueiam com explicação", () => {
    const noRisks = { validated: [], pending: 0, usableSources: 1 };
    const message = (f: AsoFacts) =>
      asoReadiness(f).find((i) => i.code === "risks_absence_not_declared")?.message;
    const legacy = facts({ risks: noRisks, riskAbsenceLegacyJobRoles: ["Soldador"] });
    expect(blocking(legacy)).toEqual(["risks_absence_not_declared"]);
    expect(message(legacy)).toMatch(
      /declaração antiga neste GES para a função "Soldador"/,
    );
    expect(message(legacy)).toMatch(/Regularização: o profissional autorizado/);
    const unlinked = facts({ risks: noRisks, riskAbsenceJobRoleUnlinked: true });
    expect(blocking(unlinked)).toEqual(["risks_absence_not_declared"]);
    expect(message(unlinked)).toMatch(
      /função do funcionário \("Soldador"\), mas a função não está mais vinculada a este GES/,
    );
  });

  it("exame de outra empresa ou com origem não comprovada não serve ao ASO (MED-07)", () => {
    expect(blocking(facts({ exam: { ...facts().exam, companyId: "c2" } }))).toEqual([
      "exam_other_company",
    ]);
    expect(blocking(facts({ exam: { ...facts().exam, companyId: null } }))).toEqual([
      "exam_company_unverified",
    ]);
  });

  it("apto com restrição bloqueia sem a confirmação do examinador; com ela, libera", () => {
    const restricted = { ...facts().exam, aptitude: "fit_with_restrictions" as const };
    expect(blocking(facts({ exam: restricted }))).toEqual([
      "aptitude_confirmation_required",
    ]);
    expect(
      blocking(
        facts({
          exam: restricted,
          examinerConclusion: {
            conclusion: "fit",
            confirmedAt: "2026-10-21T10:00:00.000Z",
          },
        }),
      ),
    ).toEqual([]);
  });

  it("avisos: exame previsto não realizado, sem plano, sem coordenador", () => {
    const codes = (f: AsoFacts) => asoReadiness(f).map((i) => i.code);
    expect(codes(facts({ procedures: [] }))).toContain("planned_not_done_0281");
    expect(codes(facts({ plannedProcedures: null }))).toContain("exam_plan_missing");
    expect(codes(facts({ coordinator: null }))).toContain("coordinator_missing");
    expect(
      blocking(facts({ procedures: [], plannedProcedures: null, coordinator: null })),
    ).toEqual([]);
  });
});

describe("composeAso", () => {
  it("apto com restrição: nunca converte; usa só a confirmação do examinador", () => {
    const restricted = { ...facts().exam, aptitude: "fit_with_restrictions" as const };
    expect(() => composeAso(facts({ exam: restricted }))).toThrow(/confirmação/);
    const confirmed = composeAso(
      facts({
        exam: restricted,
        examinerConclusion: {
          conclusion: "unfit",
          confirmedAt: "2026-10-21T10:00:00.000Z",
        },
      }),
    );
    expect(confirmed.conclusion).toMatchObject({
      result: "unfit",
      label: "Inapto para a função",
    });
    expect(confirmed.conclusion.basis).toMatch(
      /Confirmada pelo médico examinador.*2026-10-21/,
    );
    expect(JSON.stringify(confirmed)).not.toMatch(/restri/i);
  });

  it("data da confirmação do examinador é a de Brasília, não o dia UTC do carimbo", () => {
    const restricted = { ...facts().exam, aptitude: "fit_with_restrictions" as const };
    const night = composeAso(
      facts({
        exam: restricted,
        // 22h30 de 21/10 em Brasília = 01h30 de 22/10 em UTC.
        examinerConclusion: {
          conclusion: "fit",
          confirmedAt: "2026-10-22T01:30:00.000Z",
        },
      }),
    );
    expect(night.conclusion.basis).toMatch(/em 2026-10-21 \(MED-01\)/);
  });

  it("apto e inapto registrados valem como estão; o sistema não conclui", () => {
    const fit = composeAso(facts());
    expect(fit.conclusion).toMatchObject({ result: "fit", label: "Apto para a função" });
    expect(fit.conclusion.basis).toMatch(/não conclui/);
    expect(
      composeAso(facts({ exam: { ...facts().exam, aptitude: "unfit" } })).conclusion
        .label,
    ).toBe("Inapto para a função");
  });

  it("prévia com aviso, assinatura pendente, exames ordenados por data e 9999 com descrição", () => {
    const content = composeAso(
      facts({
        procedures: [
          {
            procedureCode: "9999",
            otherDescription: "Exame fictício",
            performedAt: "2026-10-19",
          },
          { procedureCode: "0281", otherDescription: null, performedAt: "2026-10-18" },
        ],
      }),
    );
    expect(content.status).toBe("preview");
    expect(content.notice).toMatch(/PRÉVIA/);
    expect(content.examiner.signature.status).toBe("pending");
    expect(content.procedures.complementary.map((p) => p.description)).toEqual([
      "Audiometria tonal ocupacional",
      "Exame fictício",
    ]);
    expect(content.procedures.clinical.performedAt).toBe("2026-10-20");
    expect(Object.keys(content)).not.toEqual(expect.arrayContaining(["notes"]));
  });

  it("hash estável e sensível ao conteúdo", () => {
    const content = composeAso(facts());
    expect(asoContentHash(content)).toBe(
      asoContentHash(JSON.parse(JSON.stringify(content))),
    );
    expect(
      asoContentHash(composeAso(facts({ exam: { ...facts().exam, aptitude: "unfit" } }))),
    ).not.toBe(asoContentHash(content));
  });
});

describe("examProcedureInputSchema", () => {
  it("código da Tabela 27, data não futura e descrição só no 9999", () => {
    expect(
      examProcedureInputSchema.safeParse({ code: "0281", performedAt: "2026-10-18" })
        .success,
    ).toBe(true);
    expect(
      examProcedureInputSchema.safeParse({ code: "12", performedAt: "2026-10-18" })
        .success,
    ).toBe(false);
    expect(
      examProcedureInputSchema.safeParse({ code: "0281", performedAt: "2999-01-01" })
        .success,
    ).toBe(false);
    expect(
      examProcedureInputSchema.safeParse({ code: "9999", performedAt: "2026-10-18" })
        .success,
    ).toBe(false);
    expect(
      examProcedureInputSchema.safeParse({
        code: "0281",
        otherDescription: "x",
        performedAt: "2026-10-18",
      }).success,
    ).toBe(false);
    expect(
      examProcedureInputSchema.safeParse({
        code: "0281",
        performedAt: "2026-10-18",
        result: "normal",
      }).success,
    ).toBe(false);
  });
});
