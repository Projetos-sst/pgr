import { buildModelChain } from "@/shared/integrations/agents/core/model-chain";

describe("buildModelChain", () => {
  it("põe o primário na frente, seguido do fallback", () => {
    expect(buildModelChain("a/primary", "b/fallback", 2).map((c) => c.model)).toEqual([
      "openrouter/a/primary",
      "openrouter/b/fallback",
    ]);
  });

  it("aplica o prefixo do roteador — o .env guarda o id do catálogo, não o do framework", () => {
    expect(buildModelChain("minimax/minimax-m3:free", "", 2)[0].model).toBe(
      "openrouter/minimax/minimax-m3:free",
    );
  });

  it("propaga maxRetries para todos os candidatos", () => {
    expect(buildModelChain("a", "b", 3).map((c) => c.maxRetries)).toEqual([3, 3]);
  });

  it("não repete o modelo quando primário e fallback são o mesmo", () => {
    expect(buildModelChain("a/dup", "a/dup", 2).map((c) => c.model)).toEqual([
      "openrouter/a/dup",
    ]);
  });

  it("fallback vazio ou só com espaço → cadeia com o primário apenas", () => {
    expect(buildModelChain("a/primary", "   ", 2)).toHaveLength(1);
  });
});
