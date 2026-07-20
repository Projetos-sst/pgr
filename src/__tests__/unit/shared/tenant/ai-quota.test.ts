import {
  FREE_AI_SUGGESTION_MONTHLY_QUOTA,
  isAiSuggestionAvailable,
} from "@/shared/tenant/plan";

describe("isAiSuggestionAvailable", () => {
  it("plano pro é ilimitado", () => {
    expect(isAiSuggestionAvailable("pro", 9999)).toBe(true);
  });

  it("plano free permite até a cota mensal", () => {
    expect(isAiSuggestionAvailable("free", 0)).toBe(true);
    expect(isAiSuggestionAvailable("free", FREE_AI_SUGGESTION_MONTHLY_QUOTA - 1)).toBe(
      true,
    );
  });

  it("plano free bloqueia ao atingir a cota", () => {
    expect(isAiSuggestionAvailable("free", FREE_AI_SUGGESTION_MONTHLY_QUOTA)).toBe(false);
    expect(isAiSuggestionAvailable("free", FREE_AI_SUGGESTION_MONTHLY_QUOTA + 5)).toBe(
      false,
    );
  });
});
