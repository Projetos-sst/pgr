/**
 * Conferência do PCMSO (NOB-148): o que bloqueia, o que só avisa e as etapas que o sistema
 * ainda não tem (nunca simuladas). Dados fictícios.
 */
import {
  buildExamProposal,
  type ProposalSource,
} from "@/shared/domains/medicine/exam-proposal";
import {
  checkPcmsoReadiness,
  type PcmsoReadinessInput,
} from "@/shared/domains/medicine/pcmso-readiness";

const COMPANY = "c1111111-1111-4111-8111-111111111111";
const NOT_AVAILABLE = ["clinics", "health_campaigns"];

function source(overrides: Partial<ProposalSource> = {}): ProposalSource {
  return {
    id: "s1",
    kind: "internal",
    title: "PGR da plataforma",
    version: "Revisão 1",
    reference: "PGR:x",
    freshness: "current",
    superseded: false,
    risks: [
      {
        id: "r1",
        status: "validated",
        content: {
          agentType: "physical",
          description: "Ruído fictício",
          exposureGroup: "Produção",
          possibleInjuries: "Perda auditiva",
          originalData: { inventory: { noxious_agent_code: "02.01.001" } },
        },
      },
    ],
    ...overrides,
  };
}

function input(overrides: Partial<PcmsoReadinessInput> = {}): PcmsoReadinessInput {
  return {
    companyId: COMPANY,
    company: {
      razaoSocial: "Empresa Fictícia Ltda",
      cnpj: "11222333000181",
      cnae: "4120-4",
      mainActivity: "Construção de edifícios",
      riskGrade: 3,
    },
    activeEmployees: 12,
    coordinator: { medicoName: "Dra. Fictícia", rqe: "6789", rqeExceptionReason: null },
    proposal: buildExamProposal([source()]),
    usableRisks: [{ description: "Ruído fictício", possibleInjuries: "Perda auditiva" }],
    usableRiskIds: ["r1"],
    activePhysicians: 2,
    examPlan: {
      approved: { version: 1, sourceIds: ["s1"], riskIds: ["r1"] },
      draftVersion: null,
    },
    interpretationCriteriaMissing: [],
    analyticalReport: { version: 1, periodStart: "2025-11-01", periodEnd: "2026-10-31" },
    ...overrides,
  };
}

const codes = (r: ReturnType<typeof checkPcmsoReadiness>, severity: string) =>
  r.items.filter((i) => i.severity === severity).map((i) => i.code);

describe("checkPcmsoReadiness", () => {
  it("plano de exames: sem plano ou só rascunho bloqueia; aprovado sobre outra fonte bloqueia; nova versão avisa", () => {
    const none = checkPcmsoReadiness(
      input({ examPlan: { approved: null, draftVersion: null } }),
    );
    expect(codes(none, "blocking")).toEqual(["exam_plan"]);
    expect(none.items.find((i) => i.code === "exam_plan")?.href).toBe(
      `/companies/${COMPANY}/exam-plan`,
    );
    const draft = checkPcmsoReadiness(
      input({ examPlan: { approved: null, draftVersion: 2 } }),
    );
    expect(draft.items.find((i) => i.code === "exam_plan")?.message).toMatch(/versão 2/);
    const outdated = checkPcmsoReadiness(
      input({
        examPlan: { approved: { version: 1, sourceIds: ["antiga"] }, draftVersion: null },
      }),
    );
    expect(codes(outdated, "blocking")).toEqual(["exam_plan_outdated"]);
    const newer = checkPcmsoReadiness(
      input({
        examPlan: {
          approved: { version: 1, sourceIds: ["s1"], riskIds: ["r1"] },
          draftVersion: 2,
        },
      }),
    );
    expect(codes(newer, "blocking")).toEqual([]);
    expect(codes(newer, "warning")).toEqual(["exam_plan_draft"]);
  });

  it("mesma fonte, outro conjunto de riscos validados: o plano aprovado fica desatualizado (bloqueia)", () => {
    // Calor validado na aprovação; Poeira validada depois, na MESMA fonte (mesmo id e versão).
    const changed = checkPcmsoReadiness(input({ usableRiskIds: ["r1", "r2"] }));
    expect(codes(changed, "blocking")).toEqual(["exam_plan_outdated"]);
    expect(changed.items.find((i) => i.code === "exam_plan_outdated")?.message).toMatch(
      /riscos validados mudaram desde o plano/,
    );
    // Risco rejeitado depois da aprovação também muda o conjunto.
    expect(codes(checkPcmsoReadiness(input({ usableRiskIds: [] })), "blocking")).toEqual([
      "exam_plan_outdated",
    ]);
    // Ordem e repetição não importam.
    const same = checkPcmsoReadiness(
      input({
        usableRiskIds: ["r2", "r1", "r1"],
        examPlan: {
          approved: { version: 1, sourceIds: ["s1"], riskIds: ["r1", "r2"] },
          draftVersion: null,
        },
      }),
    );
    expect(codes(same, "blocking")).toEqual([]);
  });

  it("plano legado (sem o conjunto de riscos): só as fontes são conferidas, com aviso", () => {
    const legacy = checkPcmsoReadiness(
      input({
        usableRiskIds: ["r1", "r2"],
        examPlan: { approved: { version: 1, sourceIds: ["s1"] }, draftVersion: null },
      }),
    );
    expect(codes(legacy, "blocking")).toEqual([]);
    expect(codes(legacy, "warning")).toEqual(["exam_plan_legacy_basis"]);
    // Fonte diferente continua bloqueando o legado.
    const otherSource = checkPcmsoReadiness(
      input({
        examPlan: { approved: { version: 1, sourceIds: ["antiga"] }, draftVersion: null },
      }),
    );
    expect(codes(otherSource, "blocking")).toEqual(["exam_plan_outdated"]);
    expect(codes(otherSource, "warning")).toEqual([]);
  });

  it("com todos os dados existentes, só restam as etapas inexistentes, e nunca está pronto", () => {
    const result = checkPcmsoReadiness(input());
    expect(codes(result, "blocking")).toEqual([]);
    expect(codes(result, "warning")).toEqual([]);
    expect(codes(result, "not_available")).toEqual(NOT_AVAILABLE);
    expect(result.ready).toBe(false);
    expect(result.counts).toEqual({ blocking: 0, warning: 0, not_available: 2 });
  });

  it("relatório analítico (NOB-154): sem relatório arquivado avisa, com link; com relatório, nada", () => {
    const none = checkPcmsoReadiness(input({ analyticalReport: null }));
    expect(codes(none, "warning")).toEqual(["analytical_report"]);
    const item = none.items.find((i) => i.code === "analytical_report")!;
    expect(item.reference).toBe("NR-7 7.5.4 e; 7.6.2");
    expect(item.href).toBe(`/companies/${COMPANY}/analytical-report`);
    expect(codes(none, "blocking")).toEqual([]);
    expect(codes(none, "not_available")).not.toContain("analytical_report");
  });

  it("critérios de interpretação (NOB-153): avisa os exames do plano sem critério do coordenador", () => {
    const missing = checkPcmsoReadiness(
      input({
        interpretationCriteriaMissing: [
          { procedureCode: "0281", description: "Audiometria tonal ocupacional" },
        ],
      }),
    );
    expect(codes(missing, "warning")).toEqual(["interpretation_criteria"]);
    const item = missing.items.find((i) => i.code === "interpretation_criteria")!;
    expect(item.message).toMatch(/1 exame\(s\).*0281 Audiometria/);
    expect(item.reference).toBe("NR-7 7.5.4 c");
    expect(item.href).toBe(`/companies/${COMPANY}/interpretation-criteria`);
    expect(codes(missing, "blocking")).toEqual([]);
    // Sem plano aprovado, o bloqueio do plano já explica; nada sobre critérios.
    const noPlan = checkPcmsoReadiness(
      input({
        examPlan: { approved: null, draftVersion: null },
        interpretationCriteriaMissing: null,
      }),
    );
    expect(noPlan.items.map((i) => i.code)).not.toContain("interpretation_criteria");
  });

  it("dados da empresa ausentes bloqueiam (MED-08)", () => {
    const result = checkPcmsoReadiness(
      input({
        company: {
          razaoSocial: " ",
          cnpj: null,
          cnae: "",
          mainActivity: null,
          riskGrade: null,
        },
      }),
    );
    expect(codes(result, "blocking")).toEqual([
      "company_identity",
      "company_cnae",
      "company_activity",
      "company_risk_grade",
    ]);
    expect(result.items.find((i) => i.code === "company_cnae")?.href).toBe(
      `/companies/${COMPANY}/edit`,
    );
  });

  it("sem funcionário ativo só avisa", () => {
    expect(codes(checkPcmsoReadiness(input({ activeEmployees: 0 })), "warning")).toEqual([
      "employees",
    ]);
  });

  it("sem coordenador bloqueia (NR-7 7.4.1 c); sem RQE avisa com a justificativa 7.5.2", () => {
    const none = checkPcmsoReadiness(input({ coordinator: null }));
    expect(none.items.find((i) => i.code === "coordinator")).toMatchObject({
      severity: "blocking",
      reference: "NR-7 7.4.1 c",
    });
    const noRqe = checkPcmsoReadiness(
      input({
        coordinator: {
          medicoName: "Dr. Ficcional",
          rqe: null,
          rqeExceptionReason: "Sem médico do trabalho na localidade",
        },
      }),
    );
    const item = noRqe.items.find((i) => i.code === "coordinator_rqe");
    expect(item?.severity).toBe("warning");
    expect(item?.message).toMatch(/Sem médico do trabalho na localidade/);
  });

  it("sobreposição de designações vigentes bloqueia sem escolher uma (NOB-109)", () => {
    const overlap = checkPcmsoReadiness(
      input({ coordinator: null, coordinatorOverlap: true }),
    );
    expect(codes(overlap, "blocking")).toEqual(["coordinator_overlap"]);
    expect(overlap.items.find((i) => i.code === "coordinator_overlap")).toMatchObject({
      reference: "NR-7 7.4.1 c",
      href: `/companies/${COMPANY}/pcmso-coordinator`,
    });
    const single = checkPcmsoReadiness(input({ coordinatorOverlap: false }));
    expect(codes(single, "blocking")).toEqual([]);
  });

  it("sem fonte de riscos bloqueia; fonte sem risco validado também, sem presumir ausência", () => {
    const noSource = checkPcmsoReadiness(
      input({ proposal: buildExamProposal([]), usableRisks: [] }),
    );
    expect(codes(noSource, "blocking")).toEqual(["risk_source"]);
    const pendingOnly = source({
      risks: [{ ...source().risks[0], status: "pending" }],
    });
    const notValidated = checkPcmsoReadiness(
      input({ proposal: buildExamProposal([pendingOnly]), usableRisks: [] }),
    );
    expect(codes(notValidated, "blocking")).toEqual(["validated_risks"]);
    expect(codes(notValidated, "warning")).toEqual(["pending_risks"]);
    expect(notValidated.items.find((i) => i.code === "validated_risks")?.message).toMatch(
      /não comprova ausência de riscos/,
    );
  });

  it("fonte que mudou depois da validação bloqueia (7.5.5)", () => {
    const changed = checkPcmsoReadiness(
      input({
        proposal: buildExamProposal([source({ freshness: "changed" })]),
        usableRisks: [],
      }),
    );
    expect(codes(changed, "blocking")).toEqual(["validated_risks", "outdated_source"]);
  });

  it("risco validado sem possível agravo e risco sem regra geram aviso", () => {
    const external = source({
      kind: "external",
      freshness: "external_reference",
      risks: [
        {
          id: "e1",
          status: "validated",
          content: {
            agentType: "biological",
            description: "Agente fictício",
            exposureGroup: "Lab",
          },
        },
      ],
    });
    const result = checkPcmsoReadiness(
      input({
        proposal: buildExamProposal([external]),
        usableRisks: [{ description: "Agente fictício", possibleInjuries: null }],
      }),
    );
    expect(codes(result, "warning")).toEqual(["possible_injuries", "risks_without_rule"]);
  });

  it("sem médico ativo bloqueia", () => {
    expect(
      codes(checkPcmsoReadiness(input({ activePhysicians: 0 })), "blocking"),
    ).toEqual(["examiners"]);
  });

  it("todo item traz referência", () => {
    for (const item of checkPcmsoReadiness(input({ coordinator: null })).items)
      expect(item.reference).toMatch(/NR-7|MED-|SEG-/);
  });
});
