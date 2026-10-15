import type { RichBlock } from "@/shared/domains/pgr/pgr-docx/defaults";
import { keepLastWords, richTextToOoxml } from "@/shared/domains/pgr/pgr-docx/rich-text";

const paragraphs = (xml: string) => xml.split("<w:p>").slice(1);
const keepsNext = (xml: string) =>
  paragraphs(xml).map((p) => p.includes("<w:keepNext/>"));
const repeat = (value: boolean, times: number) =>
  Array.from({ length: times }, () => value);

const para = (text: string): RichBlock => ({ kind: "paragraph", text });
const item = (index: number): RichBlock => ({ kind: "item", text: `a) alínea ${index}` });
const items = (count: number): RichBlock[] =>
  Array.from({ length: count }, (_, index) => item(index + 1));

describe("richTextToOoxml", () => {
  describe("parágrafo que termina com dois-pontos", () => {
    it("fica preso ao parágrafo seguinte", () => {
      const xml = richTextToOoxml([para("Os trabalhadores devem:"), para("Usar o EPI.")]);
      expect(keepsNext(xml)).toEqual([true, false]);
    });

    it("ignora espaços no fim do texto", () => {
      expect(keepsNext(richTextToOoxml([para("Atividades:   ")]))).toEqual([true]);
    });

    it("ignora a marcação de negrito que fecha depois dos dois-pontos", () => {
      expect(keepsNext(richTextToOoxml([para("**Atenção:**")]))).toEqual([true]);
    });

    it("sem dois-pontos no fim não ganha keepNext", () => {
      expect(keepsNext(richTextToOoxml([para("Texto comum.")]))).toEqual([false]);
    });

    it("dois-pontos no meio do texto não conta", () => {
      expect(keepsNext(richTextToOoxml([para("Nota: o EPI é obrigatório.")]))).toEqual([
        false,
      ]);
    });
  });

  describe("itens de lista", () => {
    it("dois itens: o primeiro fica preso ao segundo", () => {
      expect(keepsNext(richTextToOoxml(items(2)))).toEqual([true, false]);
    });

    it("todos menos o último ficam presos ao seguinte", () => {
      expect(keepsNext(richTextToOoxml(items(3)))).toEqual([true, true, false]);
    });

    it("lista de 4 itens: todos menos o último", () => {
      expect(keepsNext(richTextToOoxml(items(4)))).toEqual([true, true, true, false]);
    });

    it("lista de 5 itens: só o primeiro e o penúltimo", () => {
      const xml = richTextToOoxml(items(5));
      expect(keepsNext(xml)).toEqual([true, false, false, true, false]);
    });

    it("lista de 8 itens: só o primeiro e o penúltimo", () => {
      const xml = richTextToOoxml(items(8));
      expect(keepsNext(xml)).toEqual([true, ...repeat(false, 5), true, false]);
    });

    it("item isolado não ganha keepNext", () => {
      expect(keepsNext(richTextToOoxml(items(1)))).toEqual([false]);
    });

    it("parágrafo separa duas sequências, que são contadas à parte", () => {
      const xml = richTextToOoxml([item(1), item(2), para("Texto."), item(3), item(4)]);
      expect(keepsNext(xml)).toEqual([true, false, false, true, false]);
    });

    it("lista longa seguida de lista curta: cada uma segue a sua regra", () => {
      const xml = richTextToOoxml([...items(9), para("Texto."), ...items(2)]);
      expect(keepsNext(xml)).toEqual([
        true,
        ...repeat(false, 6),
        true,
        false,
        false,
        true,
        false,
      ]);
    });

    it("parágrafo com dois-pontos prende ao primeiro item de lista longa", () => {
      const xml = richTextToOoxml([para("Deve conter:"), ...items(7)]);
      expect(keepsNext(xml)).toEqual([true, true, ...repeat(false, 4), true, false]);
    });
  });

  describe("subtítulo", () => {
    it("continua preso ao parágrafo seguinte", () => {
      const xml = richTextToOoxml([{ kind: "subtitle", text: "Título" }, para("Corpo.")]);
      expect(keepsNext(xml)).toEqual([true, false]);
    });

    it("mantém o espaço normal entre as palavras do fim", () => {
      expect(richTextToOoxml([{ kind: "subtitle", text: "Título de seção" }])).toContain(
        "Título de seção",
      );
    });
  });

  describe("última palavra do parágrafo e do item", () => {
    it("parágrafo une as duas últimas palavras com espaço não separável", () => {
      expect(richTextToOoxml([para("Texto que termina em gerenciamento.")])).toContain(
        "em\u00A0gerenciamento.",
      );
    });

    it("item une as duas últimas palavras com espaço não separável", () => {
      expect(
        richTextToOoxml([{ kind: "item", text: "f) outros itens (etc.);" }]),
      ).toContain("itens\u00A0(etc.);");
    });
  });

  it("keepLastWithNext prende o último bloco ao conteúdo seguinte", () => {
    const blocks = [para("Um."), para("Dois.")];
    const list = [item(1), item(2)];
    const withNext = { keepLastWithNext: true };
    expect(keepsNext(richTextToOoxml(blocks, withNext))).toEqual([false, true]);
    expect(keepsNext(richTextToOoxml(blocks))).toEqual([false, false]);
    expect(keepsNext(richTextToOoxml(list, withNext))).toEqual([true, true]);
  });
});

describe("keepLastWords", () => {
  it("une as duas últimas palavras", () => {
    expect(keepLastWords("Todo trabalhador deve ser informado sobre:")).toBe(
      "Todo trabalhador deve ser informado\u00A0sobre:",
    );
  });

  it("mantém número de lei e norma colado ao 'nº' e ao número", () => {
    expect(keepLastWords("conforme a Lei nº 15.377 de 2026")).toContain(
      "Lei\u00A0nº\u00A015.377",
    );
  });

  it("palavra única fica como está", () => {
    expect(keepLastWords("palavra")).toBe("palavra");
  });

  it("última palavra longa (acima de 20 caracteres) não é unida", () => {
    const text = "ver https://exemplo.com.br/um/caminho/longo";
    expect(keepLastWords(text)).toBe(text);
  });

  it("mantém o número da NR colado à sigla", () => {
    expect(
      keepLastWords(
        "em conformidade com o item 18.5 da NR 18, elaborado por profissional legalmente habilitado;",
      ),
    ).toContain("NR\u00a018,");
    expect(keepLastWords("atender às exigências da NR 24.")).toBe(
      "atender às exigências da NR\u00a024.",
    );
    expect(keepLastWords("conforme a NR-1 vigente")).toContain("NR-1");
  });

  it("mantém 'n.º' e 'N.º' colados à sigla e ao número", () => {
    expect(
      keepLastWords("revisada pela Portaria SEPRT n.º 6.730, de 9 de dezembro de 2020"),
    ).toContain("SEPRT\u00a0n.º\u00a06.730");
    expect(keepLastWords("conforme a Lei N.º 10 de 2020")).toContain(
      "Lei\u00a0N.º\u00a010",
    );
  });

  it("cola a NR ao número no meio do parágrafo", () => {
    expect(
      keepLastWords("conforme a NR 18 e demais normas aplicáveis ao canteiro"),
    ).toContain("NR\u00a018");
  });
});
