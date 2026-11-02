/**
 * Proposta de exames (NOB-147, MED-15): só riscos validados de fonte vigente geram
 * sugestão, cada uma com a referência da NR-7; o resto aparece separado. Dados fictícios.
 */
import {
  agentCodeOf,
  buildExamProposal,
  type ProposalSource,
} from "@/shared/domains/medicine/exam-proposal";
import {
  EXAM_RULES,
  NOXIOUS_AGENTS,
  rulesForAgent,
} from "@/shared/domains/medicine/exam-rules";
import { getProcedure } from "@/shared/domains/medicine/procedure-catalog";
import type { MedicalRiskSnapshot } from "@/shared/domains/medicine/risk-sources";

const NOISE = "02.01.001";
const SILICA = "01.18.001";
const ASBESTOS = "01.02.001";

function internalRisk(
  id: string,
  agentCode: string | null,
  overrides: Partial<MedicalRiskSnapshot> = {},
): { id: string; status: "validated"; content: MedicalRiskSnapshot } {
  return {
    id,
    status: "validated",
    content: {
      agentType: agentCode === NOISE ? "physical" : "chemical",
      description: `Risco fictício ${id}`,
      exposureGroup: "Produção",
      originalData: { inventory: { noxious_agent_code: agentCode } },
      ...overrides,
    },
  };
}

function source(
  risks: ProposalSource["risks"],
  overrides: Partial<ProposalSource> = {},
): ProposalSource {
  return {
    id: "s1",
    kind: "internal",
    title: "PGR da plataforma",
    version: "Revisão 1",
    reference: "PGR:fictício",
    freshness: "current",
    superseded: false,
    risks,
    ...overrides,
  };
}

describe("regras risco → exame", () => {
  it("todo procedimento das regras existe na Tabela 27", () => {
    for (const rule of EXAM_RULES)
      expect(getProcedure(rule.procedureCode)).not.toBeNull();
  });

  it("todo agente das regras está na lista conferida da Tabela 24", () => {
    for (const rule of EXAM_RULES)
      for (const code of rule.agentCodes) expect(NOXIOUS_AGENTS[code]).toBeDefined();
  });

  it("toda regra cita a NR-7 e traz periodicidade da norma", () => {
    for (const rule of EXAM_RULES) {
      expect(rule.reference).toMatch(/^NR-7, Anexo/);
      expect(rule.periodicity.length).toBeGreaterThan(20);
    }
  });

  it("ruído → audiometria; poeiras minerais → radiografia OIT e espirometria", () => {
    expect(rulesForAgent(NOISE).map((r) => r.procedureCode)).toEqual(["0281"]);
    expect(rulesForAgent(SILICA).map((r) => r.procedureCode)).toEqual(["1078", "1057"]);
    expect(rulesForAgent("01.01.001")).toEqual([]);
  });
});

describe("agentCodeOf", () => {
  it("lê o código copiado do inventário interno", () => {
    expect(agentCodeOf(internalRisk("r1", ` ${NOISE} `).content)).toBe(NOISE);
  });
  it("fonte externa ou código vazio → null", () => {
    expect(
      agentCodeOf({ agentType: "physical", description: "x", exposureGroup: "G" }),
    ).toBeNull();
    expect(agentCodeOf(internalRisk("r1", "").content)).toBeNull();
  });
});

describe("buildExamProposal", () => {
  it("risco validado de ruído gera audiometria com origem e referência", () => {
    const proposal = buildExamProposal([source([internalRisk("r1", NOISE)])]);
    expect(proposal.requiresMedicalReview).toBe(true);
    expect(proposal.groups).toHaveLength(1);
    const [suggestion] = proposal.groups[0].suggestions;
    expect(suggestion).toMatchObject({
      procedureCode: "0281",
      procedureDescription: "Audiometria tonal ocupacional",
      reference: "NR-7, Anexo II, itens 2 e 4",
    });
    expect(suggestion.triggeredBy).toEqual([
      expect.objectContaining({ riskId: "r1", sourceId: "s1", agentCode: NOISE }),
    ]);
    expect(proposal.basis).toEqual([
      expect.objectContaining({ id: "s1", kind: "internal", version: "Revisão 1" }),
    ]);
  });

  it("não duplica exame quando dois riscos levam ao mesmo procedimento", () => {
    const proposal = buildExamProposal([
      source([internalRisk("r1", SILICA), internalRisk("r2", ASBESTOS)]),
    ]);
    const codes = proposal.groups[0].suggestions.map((s) => s.procedureCode);
    expect(codes).toEqual(["1057", "1078"]);
    const xray = proposal.groups[0].suggestions.find((s) => s.procedureCode === "1078")!;
    expect(xray.triggeredBy.map((r) => r.riskId)).toEqual(["r1", "r2"]);
    expect(xray.notes).toEqual([expect.stringContaining("30 anos")]);
  });

  it("pendente, rejeitado e fonte desatualizada não geram exame", () => {
    const pending = { ...internalRisk("p1", NOISE), status: "pending" as const };
    const rejected = { ...internalRisk("x1", NOISE), status: "rejected" as const };
    const proposal = buildExamProposal([
      source([pending, rejected]),
      source([internalRisk("o1", NOISE)], { id: "s2", freshness: "changed" }),
    ]);
    expect(proposal.groups).toEqual([]);
    expect(proposal.excluded.pending.map((r) => r.riskId)).toEqual(["p1"]);
    expect(proposal.excluded.rejected.map((r) => r.riskId)).toEqual(["x1"]);
    expect(proposal.excluded.outdated.map((r) => r.riskId)).toEqual(["o1"]);
    expect(proposal.warnings.join(" ")).toMatch(/pendente/);
    expect(proposal.warnings.join(" ")).toMatch(/desatualizada/);
  });

  it("fonte substituída é ignorada por inteiro", () => {
    const proposal = buildExamProposal([
      source([internalRisk("r1", NOISE)], { superseded: true, freshness: "superseded" }),
    ]);
    expect(proposal.basis).toEqual([]);
    expect(proposal.groups).toEqual([]);
  });

  it("risco sem código ou sem regra fica para o coordenador, sem exame inventado", () => {
    const externalRisk = {
      id: "e1",
      status: "validated" as const,
      content: {
        agentType: "biological" as const,
        description: "Agente biológico fictício",
        exposureGroup: "Laboratório",
        jobRole: "Técnico",
      },
    };
    const proposal = buildExamProposal([
      source([externalRisk], { kind: "external", freshness: "external_reference" }),
      source([internalRisk("c1", "01.01.001")], { id: "s2" }),
    ]);
    const lab = proposal.groups.find((g) => g.exposureGroup === "Laboratório")!;
    expect(lab).toMatchObject({ jobRole: "Técnico", suggestions: [] });
    expect(lab.withoutRule[0].reason).toMatch(/Sem código de agente nocivo/);
    const production = proposal.groups.find((g) => g.exposureGroup === "Produção")!;
    expect(production.suggestions).toEqual([]);
    expect(production.withoutRule[0].reason).toMatch(/Sem regra automática/);
  });

  it("separa grupos por grupo de exposição e função", () => {
    const proposal = buildExamProposal([
      source([
        internalRisk("r1", NOISE, { exposureGroup: "B" }),
        internalRisk("r2", NOISE, { exposureGroup: "A", jobRole: "Soldador" }),
        internalRisk("r3", NOISE, { exposureGroup: "A" }),
      ]),
    ]);
    expect(proposal.groups.map((g) => [g.exposureGroup, g.jobRole])).toEqual([
      ["A", null],
      ["A", "Soldador"],
      ["B", null],
    ]);
  });

  it("sem fonte ou sem riscos avisa que isso não é ausência de risco", () => {
    expect(buildExamProposal([]).warnings[0]).toMatch(/não significa ausência de riscos/);
    expect(buildExamProposal([source([])]).warnings[0]).toMatch(
      /não comprova ausência de riscos/,
    );
  });

  it("sempre avisa que a proposta é assistiva e cita o exame clínico", () => {
    const proposal = buildExamProposal([source([internalRisk("r1", NOISE)])]);
    expect(proposal.warnings.at(-1)).toMatch(/Nada aqui foi aprovado/);
    expect(proposal.clinicalExam.reference).toBe("NR-7, itens 7.5.6 e 7.5.7");
  });
});
