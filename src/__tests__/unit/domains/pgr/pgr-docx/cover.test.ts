import {
  buildCoverXml,
  COVER_TEXT_WIDTH,
  type CoverInput,
} from "@/shared/domains/pgr/pgr-docx/cover";
import { textWidth } from "@/shared/domains/pgr/pgr-docx/text-fit";

const base: CoverInput = {
  validity: "10/2026 a 09/2028",
  razaoSocial: "Construtora Horizonte Exemplo Ltda",
  nomeFantasia: "Horizonte Exemplo",
  cityState: "Campinas - SP",
  workUnit: "Obra Residencial Jardim Exemplo",
  contractNumbers: "CT-0001/2026",
  labels: { validity: "VIGÊNCIA:", contract: "CONTRATO:" },
};

const visible = (xml: string) => xml.replace(/<[^>]+>/g, "");
const sizes = (xml: string) =>
  [...xml.matchAll(/<w:sz w:val="(\d+)"\/>/g)].map(([, size]) => Number(size));
const afters = (xml: string) =>
  [...xml.matchAll(/w:after="(\d+)"/g)].map(([, after]) => Number(after));
const paragraphs = (xml: string) => xml.match(/<w:p>/g)?.length ?? 0;
const breaks = (xml: string) => xml.match(/<w:br\/>/g)?.length ?? 0;
const linesOf = (xml: string) => xml.split("<w:br/>").map(visible);

describe("buildCoverXml", () => {
  it("nome curto fica no tamanho base, numa linha, alinhado à direita", () => {
    const xml = buildCoverXml(base);
    expect(sizes(xml.razaoSocialXml)).toEqual([24]);
    expect(paragraphs(xml.razaoSocialXml)).toBe(1);
    expect(breaks(xml.razaoSocialXml)).toBe(0);
    expect(xml.razaoSocialXml).toContain('<w:jc w:val="right"/>');
    expect(xml.razaoSocialXml).toContain('<w:spacing w:before="0" w:after="40"/>');
    expect(visible(xml.razaoSocialXml)).toBe("CONSTRUTORA HORIZONTE EXEMPLO LTDA");
  });

  it("validade usa o tamanho base 26 no rótulo e no valor", () => {
    const xml = buildCoverXml(base);
    expect([...new Set(sizes(xml.validityXml))]).toEqual([26]);
    expect(visible(xml.validityXml)).toBe("VIGÊNCIA: 10/2026 a 09/2028");
    expect(afters(xml.validityXml)).toEqual([480]);
  });

  it("razão longa reduz o corpo até caber na caixa, sem quebrar a linha", () => {
    const name = "Empresa Exemplo de Obras Civis, Instalações Elétricas e Ltda";
    const xml = buildCoverXml({ ...base, razaoSocial: name });
    const [size] = sizes(xml.razaoSocialXml);
    expect(size).toBeLessThan(24);
    expect(size).toBeGreaterThanOrEqual(15);
    expect(breaks(xml.razaoSocialXml)).toBe(0);
    expect(textWidth(name.toLocaleUpperCase("pt-BR"), size, true)).toBeLessThanOrEqual(
      COVER_TEXT_WIDTH,
    );
  });

  it("unidade longa vira 2 linhas equilibradas quando nem no mínimo cabe", () => {
    const unit =
      "Obra residencial do Condomínio Jardim Exemplo, Bloco A, Torre 1, área de apoio e estacionamento do subsolo do empreendimento";
    expect(unit.length).toBeGreaterThanOrEqual(110);
    const xml = buildCoverXml({ ...base, workUnit: unit });
    expect(paragraphs(xml.workUnitXml)).toBe(1);
    expect(breaks(xml.workUnitXml)).toBe(1);
    expect(sizes(xml.workUnitXml).every((s) => s === 14)).toBe(true);
    const [first, second] = linesOf(xml.workUnitXml);
    expect(Math.abs(first.length - second.length)).toBeLessThanOrEqual(15);
    expect(textWidth(first, 14)).toBeLessThanOrEqual(COVER_TEXT_WIDTH);
    expect(textWidth(second, 14)).toBeLessThanOrEqual(COVER_TEXT_WIDTH);
  });

  it("razão social de 80 caracteres cabe numa linha (≥ 7,5 pt)", () => {
    const name =
      "Companhia Brasileira de Engenharia Civil, Construções e Montagens Industriais SA";
    expect(name.length).toBe(80);
    const xml = buildCoverXml({ ...base, razaoSocial: name });
    expect(paragraphs(xml.razaoSocialXml)).toBe(1);
    expect(breaks(xml.razaoSocialXml)).toBe(0);
    const used = [...new Set(sizes(xml.razaoSocialXml))];
    expect(used).toHaveLength(1);
    expect(used[0]).toBeGreaterThanOrEqual(15);
    expect(used[0]).toBeLessThanOrEqual(24);
    expect(textWidth(name.toLocaleUpperCase("pt-BR"), used[0], true)).toBeLessThanOrEqual(
      COVER_TEXT_WIDTH,
    );
  });

  it("razão social extrema quebra em várias linhas sem nenhuma passar da largura", () => {
    const name = "Companhia Brasileira de Engenharia Civil Construções Montagens "
      .repeat(4)
      .trim();
    expect(name.length).toBeGreaterThan(200);
    const xml = buildCoverXml({ ...base, razaoSocial: name });
    const size = sizes(xml.razaoSocialXml)[0];
    expect(breaks(xml.razaoSocialXml)).toBeGreaterThanOrEqual(2);
    for (const line of linesOf(xml.razaoSocialXml)) {
      expect(textWidth(line, size, true)).toBeLessThanOrEqual(COVER_TEXT_WIDTH);
    }
  });

  it("fantasia e cidade nunca ficam maiores que a razão social", () => {
    const name =
      "Companhia Brasileira de Engenharia Civil, Construções e Montagens Industriais SA";
    const xml = buildCoverXml({ ...base, razaoSocial: name });
    const [razaoSize] = sizes(xml.razaoSocialXml);
    expect(sizes(xml.nomeFantasiaXml)).toHaveLength(1);
    expect(sizes(xml.cityStateXml)).toHaveLength(1);
    expect(sizes(xml.nomeFantasiaXml).every((s) => s <= razaoSize)).toBe(true);
    expect(sizes(xml.cityStateXml).every((s) => s <= razaoSize)).toBe(true);

    const short = buildCoverXml(base);
    expect(sizes(short.nomeFantasiaXml)).toEqual([19]);
    expect(sizes(short.cityStateXml)).toEqual([19]);
  });

  it("unidade e contrato nunca ficam maiores que a razão social", () => {
    const name =
      "Companhia Brasileira de Engenharia Civil, Construções e Montagens Industriais SA";
    const xml = buildCoverXml({ ...base, razaoSocial: name });
    const [razaoSize] = sizes(xml.razaoSocialXml);
    expect(sizes(xml.workUnitXml).every((s) => s <= razaoSize)).toBe(true);
    expect(sizes(xml.contractXml).every((s) => s <= razaoSize)).toBe(true);

    const short = buildCoverXml(base);
    expect([...new Set(sizes(short.workUnitXml))]).toEqual([19]);
    expect([...new Set(sizes(short.contractXml))]).toEqual([19]);
  });

  it("unidade de 120 caracteres vira 2 linhas no tamanho mínimo", () => {
    const unit =
      "Obra de ampliação do Centro de Distribuição Regional Sudeste, Galpão Logístico 3, Doca Norte e Pátio de Manobras Externo";
    expect(unit.length).toBe(120);
    const xml = buildCoverXml({ ...base, workUnit: unit });
    expect(breaks(xml.workUnitXml)).toBe(1);
    expect(sizes(xml.workUnitXml).every((s) => s === 14)).toBe(true);
    const widths = linesOf(xml.workUnitXml).map((line) => textWidth(line, 14));
    expect(Math.max(...widths)).toBeLessThanOrEqual(COVER_TEXT_WIDTH);
  });

  it("linha sem valor some (string vazia) e a razão continua", () => {
    const xml = buildCoverXml({
      ...base,
      validity: " ",
      nomeFantasia: "",
      cityState: "",
      workUnit: "",
      contractNumbers: "",
    });
    expect(xml.validityXml).toBe("");
    expect(xml.nomeFantasiaXml).toBe("");
    expect(xml.cityStateXml).toBe("");
    expect(xml.workUnitXml).toBe("");
    expect(xml.contractXml).toBe("");
    expect(xml.razaoSocialXml).not.toBe("");
  });

  it("nome fantasia some quando repete a razão, sem diferença de caixa e espaços", () => {
    const xml = buildCoverXml({
      ...base,
      razaoSocial: "Construtora Horizonte  Ltda",
      nomeFantasia: " construtora horizonte ltda ",
    });
    expect(xml.nomeFantasiaXml).toBe("");
    expect(afters(xml.razaoSocialXml)).toEqual([40]);
    expect(afters(xml.cityStateXml)).toEqual([240]);
  });

  it("o último parágrafo visível do bloco da empresa recebe o respiro de 240", () => {
    const full = buildCoverXml(base);
    expect(afters(full.razaoSocialXml)).toEqual([40]);
    expect(afters(full.nomeFantasiaXml)).toEqual([40]);
    expect(afters(full.cityStateXml)).toEqual([240]);
    expect(afters(full.workUnitXml)).toEqual([40]);
    expect(afters(full.contractXml)).toEqual([40]);

    const noCity = buildCoverXml({ ...base, cityState: "" });
    expect(afters(noCity.nomeFantasiaXml)).toEqual([240]);
    expect(afters(noCity.razaoSocialXml)).toEqual([40]);

    const onlyRazao = buildCoverXml({ ...base, nomeFantasia: "", cityState: "" });
    expect(afters(onlyRazao.razaoSocialXml)).toEqual([240]);
  });

  it("empresa, unidade e contratos em caixa alta; a vigência fica como veio", () => {
    const xml = buildCoverXml({
      ...base,
      validity: "Até 05/2028",
      cityState: "Campinas - sp",
      workUnit: "Obra jardim",
      contractNumbers: "ct-1/2026 e ct-2/2026",
    });
    expect(visible(xml.validityXml)).toBe("VIGÊNCIA: Até 05/2028");
    expect(visible(xml.cityStateXml)).toBe("CAMPINAS - SP");
    expect(visible(xml.workUnitXml)).toBe("OBRA JARDIM");
    expect(visible(xml.contractXml)).toBe("CONTRATO: CT-1/2026 E CT-2/2026");
  });

  it("texto com tag {{...}} da prévia preserva a caixa", () => {
    const xml = buildCoverXml({
      ...base,
      razaoSocial: "{{company.razaoSocial}}",
      cityState: "{{company.cityState}}",
    });
    expect(visible(xml.razaoSocialXml)).toBe("{{company.razaoSocial}}");
    expect(visible(xml.cityStateXml)).toBe("{{company.cityState}}");
  });

  it("anotado: o rótulo ganha o sombreado semi-fixo e o valor não", () => {
    const annotated = buildCoverXml(base, { annotate: true, labelShading: "FFD2A6" });
    expect(annotated.validityXml).toContain('w:fill="FFD2A6"');
    expect(annotated.contractXml).toContain('w:fill="FFD2A6"');
    expect(annotated.razaoSocialXml).not.toContain("FFD2A6");
    expect(annotated.workUnitXml).not.toContain("FFD2A6");
  });

  it("sem anotação não há sombreado, mesmo com a cor informada", () => {
    const plain = buildCoverXml(base, { labelShading: "FFD2A6" });
    expect(plain.validityXml).not.toContain("FFD2A6");
    expect(plain.contractXml).not.toContain("FFD2A6");
  });

  it("rótulo usa a cor primária forte e o valor a cor do texto", () => {
    const xml = buildCoverXml(base);
    expect(xml.validityXml).toContain('<w:color w:val="4F46E5"/>');
    expect(xml.validityXml).toContain('<w:color w:val="1B1F2E"/>');
    expect(xml.contractXml).toContain('<w:color w:val="52576E"/>');
  });
});
