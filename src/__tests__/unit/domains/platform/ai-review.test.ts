import { aiFillErrorMessage } from "@/shared/domains/platform/ai-review";

describe("aiFillErrorMessage", () => {
  it("explica a IA indisponível e manda seguir manualmente", () => {
    expect(aiFillErrorMessage({ code: "AI_UNAVAILABLE", message: "x" })).toMatch(
      /indisponível.*manualmente/,
    );
  });

  it("explica a cota mensal estourada", () => {
    expect(aiFillErrorMessage({ code: "QUOTA_EXCEEDED", message: "x" })).toMatch(
      /limite mensal/,
    );
  });

  it("repassa a mensagem dos outros erros", () => {
    expect(
      aiFillErrorMessage({ code: "FK_NOT_FOUND", message: "GES não encontrado." }),
    ).toBe("GES não encontrado.");
  });
});
