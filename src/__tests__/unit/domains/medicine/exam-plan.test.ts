/**
 * Plano de exames (NOB-150): schemas das decisões do coordenador e itens do rascunho a partir
 * da proposta. Dados fictícios.
 */
import {
  addItemSchema,
  approvePlanSchema,
  basedOnFromProposal,
  draftItemsFromProposal,
  itemDecisionSchema,
} from "@/shared/domains/medicine/exam-plan";
import {
  buildExamProposal,
  type ProposalSource,
} from "@/shared/domains/medicine/exam-proposal";

const WHY = "Justificativa clínica fictícia.";

// NOB-112 (etapa E): mensagens em português onde o padrão do Zod vazava em inglês.
describe("mensagens dos schemas do plano", () => {
  const messages = (r: { error?: { issues: { message: string }[] } }) =>
    (r.error?.issues ?? []).map((i) => i.message);

  it("decisão inválida e textos longos têm mensagem própria", () => {
    expect(
      messages(itemDecisionSchema.safeParse({ decision: "x", periodicity: "Anual" })),
    ).toContain("Escolha manter ou retirar o exame.");
    const long = "x".repeat(501);
    const added = messages(
      addItemSchema.safeParse({
        exposureGroup: long,
        jobRole: long,
        code: "0281",
        otherDescription: long,
        periodicity: "Anual",
        justification: WHY,
      }),
    );
    expect(added).toContain("Máximo de 500 caracteres.");
    expect(added.join(" ")).not.toMatch(/Too big|Too small/);
  });
});

function source(code: string, group = "Produção", jobRole?: string): ProposalSource {
  return {
    id: "s1",
    kind: "internal",
    title: "PGR da plataforma",
    version: "Revisão 3",
    reference: "PGR:x",
    freshness: "current",
    superseded: false,
    risks: [
      {
        id: `r-${code}`,
        status: "validated",
        content: {
          agentType: "chemical",
          description: "Risco fictício",
          exposureGroup: group,
          jobRole,
          originalData: { inventory: { noxious_agent_code: code } },
        },
      },
    ],
  };
}

describe("itemDecisionSchema", () => {
  it("manter não exige justificativa; retirar exige", () => {
    expect(
      itemDecisionSchema.safeParse({ decision: "kept", periodicity: "Anual" }).success,
    ).toBe(true);
    expect(
      itemDecisionSchema.safeParse({ decision: "removed", periodicity: "Anual" }).success,
    ).toBe(false);
    expect(
      itemDecisionSchema.safeParse({
        decision: "removed",
        periodicity: "Anual",
        justification: WHY,
      }).success,
    ).toBe(true);
  });

  it("periodicidade obrigatória e campos extras recusados", () => {
    expect(
      itemDecisionSchema.safeParse({ decision: "kept", periodicity: "" }).success,
    ).toBe(false);
    expect(
      itemDecisionSchema.safeParse({
        decision: "kept",
        periodicity: "Anual",
        updatedBy: "x",
      }).success,
    ).toBe(false);
  });
});

describe("addItemSchema", () => {
  const base = { exposureGroup: "Produção", periodicity: "Anual", justification: WHY };
  it("aceita código da Tabela 27 e exige justificativa", () => {
    expect(addItemSchema.parse({ ...base, code: "1057" })).toMatchObject({
      code: "1057",
      jobRole: "",
    });
    expect(
      addItemSchema.safeParse({ ...base, code: "1057", justification: "" }).success,
    ).toBe(false);
  });
  it("recusa código inventado; 9999 exige descrição", () => {
    expect(addItemSchema.safeParse({ ...base, code: "0000" }).success).toBe(false);
    expect(addItemSchema.safeParse({ ...base, code: "9999" }).success).toBe(false);
    expect(
      addItemSchema.safeParse({
        ...base,
        code: "9999",
        otherDescription: "Exame fictício",
      }).success,
    ).toBe(true);
  });
});

describe("approvePlanSchema", () => {
  it("observação opcional e limitada", () => {
    expect(approvePlanSchema.parse({})).toEqual({});
    expect(approvePlanSchema.safeParse({ note: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("draftItemsFromProposal", () => {
  it("um item por grupo × função × procedimento, com a regra de origem", () => {
    const proposal = buildExamProposal([source("01.18.001", "Britagem", "Operador")]);
    expect(draftItemsFromProposal(proposal)).toEqual([
      expect.objectContaining({
        exposureGroup: "Britagem",
        jobRole: "Operador",
        procedureCode: "1057",
        ruleId: "nr7-anexo-iii-espirometria",
      }),
      expect.objectContaining({
        procedureCode: "1078",
        ruleId: "nr7-anexo-iii-radiografia-torax",
      }),
    ]);
  });

  it("sem sugestões, rascunho vazio; proveniência registra fontes e exclusões", () => {
    const proposal = buildExamProposal([source("01.01.001")]);
    expect(draftItemsFromProposal(proposal)).toEqual([]);
    expect(basedOnFromProposal(proposal)).toMatchObject({
      sources: [{ id: "s1", kind: "internal", version: "Revisão 3" }],
      withoutRule: 1,
    });
  });
});
