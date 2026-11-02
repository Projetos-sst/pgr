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
const NOT_AVAILABLE = [
  "interpretation_criteria",
  "clinics",
  "health_campaigns",
  "analytical_report",
];

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
    activePhysicians: 2,
    examPlan: { approved: { version: 1, sourceIds: ["s1"] }, draftVersion: null },
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
        examPlan: { approved: { version: 1, sourceIds: ["s1"] }, draftVersion: 2 },
      }),
    );
    expect(codes(newer, "blocking")).toEqual([]);
    expect(codes(newer, "warning")).toEqual(["exam_plan_draft"]);
  });

  it("com todos os dados existentes, só restam as etapas inexistentes, e nunca está pronto", () => {
    const result = checkPcmsoReadiness(input());
    expect(codes(result, "blocking")).toEqual([]);
    expect(codes(result, "warning")).toEqual([]);
    expect(codes(result, "not_available")).toEqual(NOT_AVAILABLE);
    expect(result.ready).toBe(false);
    expect(result.counts).toEqual({ blocking: 0, warning: 0, not_available: 4 });
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
