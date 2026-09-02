import {
  flexibleOptionalText,
  flexibleText,
} from "@/shared/integrations/agents/core/flexible-text";

/**
 * Regressão do defeito que descartava um plano 5W2H inteiro e correto porque o modelo
 * devolvia `how` como lista de passos em vez de string.
 */
describe("flexibleText", () => {
  const schema = flexibleText("campo");

  it("aceita string e devolve intacta", () => {
    expect(schema.parse("Instalar exaustor")).toBe("Instalar exaustor");
  });

  it("converte lista de passos em texto numerado", () => {
    expect(schema.parse(["Mapear pontos", "Instalar exaustor", "Treinar equipe"])).toBe(
      "1. Mapear pontos\n2. Instalar exaustor\n3. Treinar equipe",
    );
  });

  it("não numera lista de um item só — não é sequência de passos", () => {
    expect(schema.parse(["Instalar exaustor"])).toBe("Instalar exaustor");
  });

  it("descarta itens vazios da lista antes de numerar", () => {
    expect(schema.parse(["Mapear", "  ", "", "Treinar"])).toBe("1. Mapear\n2. Treinar");
  });

  it("converte número em texto", () => {
    expect(schema.parse(3)).toBe("3");
  });

  it("continua rejeitando o que não é texto nem lista", () => {
    expect(schema.safeParse({ passo: 1 }).success).toBe(false);
    expect(schema.safeParse(null).success).toBe(false);
  });
});

describe("flexibleOptionalText", () => {
  const schema = flexibleOptionalText("campo");

  it.each([
    ["ausente", undefined],
    ["nulo", null],
    ["string vazia", ""],
    ["só espaços", "   "],
    ["lista vazia", []],
  ])("trata %s como ausente", (_label, value) => {
    expect(schema.parse(value)).toBeUndefined();
  });

  it("preserva conteúdo real", () => {
    expect(schema.parse(["Ruído", "Vibração"])).toBe("1. Ruído\n2. Vibração");
  });
});
