import {
  campaignInputSchema,
  canActivateCampaign,
  canTransitionStatus,
  parseOptions,
  questionInputSchema,
  toCampaignListItem,
} from "@/shared/domains/psychosocial/campaigns";
import {
  classifyLevel,
  deriveRisks,
  type QuestionStat,
} from "@/shared/domains/psychosocial/derivation";
import { submitResponseSchema } from "@/shared/domains/psychosocial/responses";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("campaignInputSchema", () => {
  it("aceita campanha válida", () => {
    const parsed = campaignInputSchema.parse({
      name: "Clima 2026",
      companyId: UUID,
      workUnitId: UUID,
      startsAt: "2026-07-01",
      endsAt: "2026-07-31",
    });
    expect(parsed.name).toBe("Clima 2026");
  });

  it("rejeita data fim anterior à início e nome vazio", () => {
    expect(() =>
      campaignInputSchema.parse({
        name: "X",
        companyId: UUID,
        workUnitId: UUID,
        startsAt: "2026-07-31",
        endsAt: "2026-07-01",
      }),
    ).toThrow();
    expect(() =>
      campaignInputSchema.parse({ name: "  ", companyId: UUID, workUnitId: UUID }),
    ).toThrow();
  });

  it("aceita rascunho sem datas", () => {
    const parsed = campaignInputSchema.parse({
      name: "Rascunho",
      companyId: UUID,
      workUnitId: UUID,
    });
    expect(parsed.startsAt).toBeUndefined();
  });
});

describe("questionInputSchema", () => {
  it("exige texto e tipo fechado", () => {
    expect(
      questionInputSchema.parse({ text: "Como você se sente?", questionType: "likert" })
        .questionType,
    ).toBe("likert");
    expect(() =>
      questionInputSchema.parse({ text: "", questionType: "likert" }),
    ).toThrow();
    expect(() =>
      questionInputSchema.parse({ text: "x", questionType: "invalid" }),
    ).toThrow();
  });
});

describe("regras de status", () => {
  it("não ativa sem perguntas", () => {
    expect(canActivateCampaign(0)).toBe(false);
    expect(canActivateCampaign(3)).toBe(true);
  });

  it("transições válidas", () => {
    expect(canTransitionStatus("draft", "active")).toBe(true);
    expect(canTransitionStatus("active", "closed")).toBe(true);
    expect(canTransitionStatus("closed", "active")).toBe(true);
    expect(canTransitionStatus("archived", "active")).toBe(false);
    expect(canTransitionStatus("draft", "closed")).toBe(false);
  });
});

describe("submitResponseSchema", () => {
  it("aceita respostas mistas", () => {
    const parsed = submitResponseSchema.parse({
      answers: [
        { questionId: UUID, valueInt: 4 },
        { questionId: UUID, valueText: "comentário" },
      ],
    });
    expect(parsed.answers).toHaveLength(2);
  });
});

describe("derivação de riscos", () => {
  it("classifica nível pela média", () => {
    expect(classifyLevel(4.6)).toBe(4);
    expect(classifyLevel(3.8)).toBe(3);
    expect(classifyLevel(3.1)).toBe(2);
    expect(classifyLevel(2.0)).toBe(1);
  });

  it("deriva só Likert acima do threshold", () => {
    const stats: QuestionStat[] = [
      {
        questionId: "a",
        text: "Sobrecarga",
        questionType: "likert",
        average: 4.2,
        responseCount: 10,
      },
      {
        questionId: "b",
        text: "Apoio",
        questionType: "likert",
        average: 2.1,
        responseCount: 10,
      },
      {
        questionId: "c",
        text: "Comentário",
        questionType: "free_text",
        average: null,
        responseCount: 5,
      },
      {
        questionId: "d",
        text: "Sem respostas",
        questionType: "likert",
        average: null,
        responseCount: 0,
      },
    ];
    const risks = deriveRisks(stats, 3);
    expect(risks).toHaveLength(1);
    expect(risks[0].factor).toBe("Sobrecarga");
    expect(risks[0].level).toBe(3);
    expect(risks[0].sourceQuestionId).toBe("a");
  });
});

describe("helpers", () => {
  it("parseOptions divide por linha", () => {
    expect(parseOptions("A\nB\n\nC ")).toEqual(["A", "B", "C"]);
    expect(parseOptions(null)).toEqual([]);
  });

  it("projeta linha da listagem", () => {
    expect(
      toCampaignListItem({
        id: "c1",
        name: "Clima",
        status: "active",
        companyName: "ACME",
        workUnitName: "Obra 1",
        startsAt: "2026-07-01",
        endsAt: null,
        questionCount: 5,
      }),
    ).toMatchObject({ statusLabel: "Ativa", questionCount: 5, workUnitName: "Obra 1" });
  });
});
