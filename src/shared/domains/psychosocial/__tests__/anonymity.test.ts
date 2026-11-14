import {
  MIN_PSYCHOSOCIAL_GROUP_SIZE,
  protectQuestionStat,
} from "@/shared/domains/psychosocial/anonymity";
import { deriveRisks, type QuestionStat } from "@/shared/domains/psychosocial/derivation";

function likertStat(responseCount: number): QuestionStat {
  return {
    questionId: "q1",
    text: "Pressão por metas?",
    questionType: "likert",
    average: 4.8,
    responseCount,
  };
}

describe("anonimato do psicossocial (NOB-181, SEG-34)", () => {
  it("usa 5 como grupo mínimo provisório (DT-17)", () => {
    expect(MIN_PSYCHOSOCIAL_GROUP_SIZE).toBe(5);
  });

  it("oculta a média com n-1 respostas", () => {
    const stat = protectQuestionStat(likertStat(MIN_PSYCHOSOCIAL_GROUP_SIZE - 1));

    expect(stat.average).toBeNull();
    expect(stat.suppressed).toBe(true);
  });

  it("mostra a média a partir de n respostas", () => {
    const stat = protectQuestionStat(likertStat(MIN_PSYCHOSOCIAL_GROUP_SIZE));

    expect(stat.average).toBe(4.8);
    expect(stat.suppressed).toBe(false);
  });

  it("não deriva risco de um grupo abaixo do mínimo", () => {
    const small = protectQuestionStat(likertStat(MIN_PSYCHOSOCIAL_GROUP_SIZE - 1));
    const enough = protectQuestionStat(likertStat(MIN_PSYCHOSOCIAL_GROUP_SIZE));

    expect(deriveRisks([small])).toEqual([]);
    expect(deriveRisks([enough])).toHaveLength(1);
  });
});
