import {
  buildModelChain,
  parseModelList,
} from "@/shared/integrations/agents/core/model-chain";

describe("buildModelChain", () => {
  it("põe o primário na frente, seguido dos fallbacks na ordem", () => {
    const chain = buildModelChain("a/primary", ["b/first", "c/second"], 2);
    expect(chain.map((c) => c.model)).toEqual([
      "openrouter/a/primary",
      "openrouter/b/first",
      "openrouter/c/second",
    ]);
  });

  it("aplica o prefixo do roteador — o .env guarda o id do catálogo, não o do framework", () => {
    expect(buildModelChain("minimax/minimax-m3:free", [], 2)[0].model).toBe(
      "openrouter/minimax/minimax-m3:free",
    );
  });

  it("propaga maxRetries para todos os candidatos", () => {
    expect(buildModelChain("a", ["b"], 3).map((c) => c.maxRetries)).toEqual([3, 3]);
  });

  it("não repete um modelo que aparece como primário e como fallback", () => {
    const chain = buildModelChain("a/dup", ["a/dup", "b/other"], 2);
    expect(chain.map((c) => c.model)).toEqual(["openrouter/a/dup", "openrouter/b/other"]);
  });

  it("descarta entrada vazia ou só com espaço", () => {
    expect(buildModelChain("a/primary", ["", "   "], 2)).toHaveLength(1);
  });

  it("sem fallback configurado, a cadeia é só o primário", () => {
    expect(buildModelChain("a/primary", [], 2)).toHaveLength(1);
  });
});

describe("parseModelList", () => {
  it("separa por vírgula e apara espaços", () => {
    expect(parseModelList(" a/one , b/two ")).toEqual(["a/one", "b/two"]);
  });

  it("ausente/vazio → null, para o chamador cair no default", () => {
    expect(parseModelList(undefined)).toBeNull();
    expect(parseModelList("")).toBeNull();
    expect(parseModelList(" , , ")).toBeNull();
  });
});
