import { parseModelInstructions } from "@/shared/domains/safety/ai-service-order-instructions";
import { MAX_ITEM_DESCRIPTION } from "@/shared/domains/safety/service-order";

describe("parseModelInstructions", () => {
  it("aceita envelope { instructions } e array cru", () => {
    expect(
      parseModelInstructions({ instructions: [{ description: "Utilize o capacete." }] }),
    ).toHaveLength(1);
    expect(parseModelInstructions([{ description: "Utilize o capacete." }])).toHaveLength(
      1,
    );
  });

  /** O modelo alterna entre string solta e objeto; as duas formas trazem a instrução. */
  it("aceita item como string", () => {
    expect(parseModelInstructions(["Utilize o capacete."])).toEqual([
      { description: "Utilize o capacete." },
    ]);
  });

  /**
   * O limite é o da coluna: instrução truncada no insert seria pior que descartada — o
   * trabalhador assinaria uma frase cortada no meio.
   */
  it("descarta instrução acima do limite da coluna", () => {
    expect(parseModelInstructions(["x".repeat(MAX_ITEM_DESCRIPTION + 1)])).toEqual([]);
    expect(parseModelInstructions(["x".repeat(MAX_ITEM_DESCRIPTION)])).toHaveLength(1);
  });

  it("descarta item inválido sem derrubar o lote", () => {
    expect(parseModelInstructions([{ nada: 1 }, "Inspecione o cinto."])).toHaveLength(1);
  });

  it("remove repetição interna", () => {
    expect(
      parseModelInstructions(["Utilize o capacete.", "utilize o capacete"]),
    ).toHaveLength(1);
  });

  it("não repete o que a OS já contém", () => {
    const out = parseModelInstructions(
      ["Utilize o capacete.", "Inspecione o cinto."],
      ["Utilize o capacete"],
    );
    expect(out).toEqual([{ description: "Inspecione o cinto." }]);
  });

  it("trata lista vazia e formato inesperado como resultado vazio", () => {
    expect(parseModelInstructions({ instructions: [] })).toEqual([]);
    expect(parseModelInstructions(null)).toEqual([]);
  });
});
