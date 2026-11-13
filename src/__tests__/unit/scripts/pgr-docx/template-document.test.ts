/**
 * @jest-environment node
 */
import { Packer } from "docx";
import PizZip from "pizzip";

import { PGR_DOCX_STYLE_IDS } from "@/shared/domains/pgr/pgr-docx/ooxml";

import { buildTemplateDocument } from "../../../../../scripts/pgr-docx/template-document";

type Built = { document: string; styles: string };

async function build(mode: "template" | "annotated"): Promise<Built> {
  const zip = new PizZip(await Packer.toBuffer(buildTemplateDocument(mode)));
  return {
    document: zip.file("word/document.xml")?.asText() ?? "",
    styles: zip.file("word/styles.xml")?.asText() ?? "",
  };
}

function paragraphOf(xml: string, marker: string) {
  const at = xml.indexOf(marker);
  const start = Math.max(xml.lastIndexOf("<w:p>", at), xml.lastIndexOf("<w:p ", at));
  return xml.slice(start, xml.indexOf("</w:p>", at) + "</w:p>".length);
}

function rowOf(xml: string, marker: string) {
  const at = xml.indexOf(marker);
  const start = Math.max(xml.lastIndexOf("<w:tr>", at), xml.lastIndexOf("<w:tr ", at));
  return xml.slice(start, xml.indexOf("</w:tr>", at) + "</w:tr>".length);
}

function styleOf(styles: string, id: string) {
  const pattern = new RegExp(`<w:style [^>]*w:styleId="${id}"[\\s\\S]*?</w:style>`);
  return styles.match(pattern)?.[0] ?? "";
}

function tableOf(xml: string, marker: string) {
  const at = xml.indexOf(marker);
  const start = xml.lastIndexOf("<w:tbl>", at);
  return xml.slice(start, xml.indexOf("</w:tbl>", at) + "</w:tbl>".length);
}

describe("buildTemplateDocument", () => {
  let template: Built;
  const para = (marker: string) => paragraphOf(template.document, marker);
  const style = (id: string) => styleOf(template.styles, id);

  beforeAll(async () => {
    template = await build("template");
  });

  it("modo anotado também monta a capa e o endereço por linha pronta", async () => {
    const annotated = await build("annotated");
    expect(annotated.document).toContain("{{@cover.validityXml}}");
    expect(annotated.document).toContain("{{@workUnitAddressXml}}");
  });

  it("capa recebe as seis linhas OOXML da empresa e do contrato, nesta ordem", () => {
    const positions = [
      "cover.validityXml",
      "cover.razaoSocialXml",
      "cover.nomeFantasiaXml",
      "cover.cityStateXml",
      "cover.workUnitXml",
      "cover.contractXml",
    ].map((tag) => template.document.indexOf(`{{@${tag}}}`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("identificação usa uma única linha pronta para o endereço da unidade", () => {
    expect(template.document).toContain("{{@workUnitAddressXml}}");
    expect(template.document).not.toContain("{{workUnit.address}}");
    expect(template.document).not.toContain("{{workUnit.addressCity}}");
  });

  it("seção 4 não começa em página nova; a introdução continua começando", () => {
    expect(para("{{titles.jobRoles}}")).not.toContain("<w:pageBreakBefore");
    expect(para("{{titles.introduction}}")).toContain("<w:pageBreakBefore");
  });

  it("quadro de funções usa as larguras 2300, 4400, 2500 e 1266", () => {
    expect(template.document).toMatch(
      /w:gridCol w:w="2300"[^>]*>\s*<w:gridCol w:w="4400"[^>]*>\s*<w:gridCol w:w="2500"[^>]*>\s*<w:gridCol w:w="1266"/,
    );
  });

  it("parágrafo fixo que termina em dois-pontos fica preso ao seguinte", () => {
    expect(para("Os procedimentos de respostas aos cenários")).toContain("<w:keepNext");
  });

  it("parágrafo fixo cola as duas últimas palavras", () => {
    expect(template.document).toContain("sua\u00A0efetividade.");
    expect(template.document).toContain("devem\u00A0prever:");
  });

  it("números de norma e lei e 'Direito de Recusa' não quebram", () => {
    const xml = template.document;
    expect(xml).toContain("Lei\u00A0nº\u00A015.377");
    expect(xml).toContain("MTP\u00A0nº\u00A0816");
    expect(xml).toContain("Regulamentadora\u00A0nº\u00A024");
    expect(xml).toContain("Direito\u00A0de\u00A0Recusa");
    expect(xml).toContain("NR\u00A024");
    expect(template.document).toContain("NR\u00A0–\u00A00");
  });

  it("descrição do processo no inventário fica presa ao conteúdo seguinte", () => {
    expect(para("{{processDescription}}")).toContain("<w:keepNext");
  });

  it("última linha do cartão de risco fica presa ao fim do risco", () => {
    expect(para("{{result}}")).toContain("<w:keepNext");
    expect(para("{{toleranceLimit}}")).toContain("<w:keepNext");
  });

  it("estilos de texto controlam viúvas e órfãs e títulos não se partem", () => {
    expect(style(PGR_DOCX_STYLE_IDS.body)).toContain("<w:widowControl");
    expect(style(PGR_DOCX_STYLE_IDS.item)).toContain("<w:widowControl");
    expect(style("PgrHeading1")).toContain("<w:keepLines");
    expect(style("PgrHeading2")).toContain("<w:keepLines");
    expect(style(PGR_DOCX_STYLE_IDS.subtitle)).toContain("<w:keepLines");
  });

  it("Anexo I dá mais largura à coluna Ação", () => {
    const table = tableOf(template.document, "{{#annexActions}}");
    const grid = [...table.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)];
    expect(grid.map((m) => Number(m[1]))).toEqual([1800, 1900, 2966, 1550, 1000, 1250]);
  });

  it("linha de vazio não mostra a borda entre a mensagem e a célula que fecha o laço", () => {
    const xml = template.document;
    const markers = ["{{^annexActions}}", "{{^measures}}", "{{^epis}}", "{{^actions}}"];
    for (const marker of markers) {
      const at = xml.indexOf(marker);
      const messageStart = xml.lastIndexOf("<w:tc>", at);
      const messageEnd = xml.indexOf("</w:tc>", at) + "</w:tc>".length;
      const closingStart = xml.indexOf("<w:tc>", messageEnd);
      const closingEnd = xml.indexOf("</w:tc>", closingStart) + "</w:tc>".length;
      const message = xml.slice(messageStart, messageEnd);
      const closing = xml.slice(closingStart, closingEnd);
      expect(message).toMatch(/<w:right [^>]*w:val="nil"/);
      expect(closing).toMatch(/<w:left [^>]*w:val="nil"/);
      expect(closing).toContain(`{{/${marker.slice(3, -2)}}}`);
    }
  });

  it("item a) das emergências fica preso ao seguinte; o item b) não", () => {
    expect(para("a) os meios e recursos")).toContain("<w:keepNext");
    expect(para("b) as medidas necessárias")).not.toContain("<w:keepNext");
  });

  it("parágrafo que abre a lista de vários empregados fica preso ao seguinte", () => {
    expect(para("Sempre que vários empregados")).toContain("<w:keepNext");
  });

  it("características construtivas ficam presas ao seguinte, menos 'Outras características'", () => {
    expect(para("{{construction.buildingType}}")).toContain("<w:keepNext");
    expect(para("{{construction.other}}")).not.toContain("<w:keepNext");
  });

  it("identificação esconde campos opcionais vazios e mostra 'Não informado' nos demais", () => {
    const cnpj = para("{{company.cnpj}}");
    expect(cnpj).toContain("{{#company.stateRegistration}}");
    expect(cnpj).toContain("{{/company.stateRegistration}}");
    expect(cnpj).toContain("{{#company.phone}}");
    expect(cnpj).toContain("{{/company.phone}}");
    expect(para("{{company.cnae}}")).toContain("{{^company.cnae}}");
    expect(para("{{company.cnae}}")).toContain("Não informado");
    expect(para("{{workUnit.name}}")).toContain("{{#workUnit.contractNumbers}}");
    expect(para("{{responsibles.author}}")).toContain("{{#responsibles.coauthors}}");
    expect(template.document).toContain("{{^validUntil}}");
  });

  it("quadro de funções: parte inteira, cabeça, meio e cauda sem vão entre as partes", () => {
    const whole = rowOf(template.document, "{{#whole}}");
    const head = rowOf(template.document, "{{#head}}");
    const body = rowOf(template.document, "{{#body}}");
    const tail = rowOf(template.document, "{{#tail}}");
    const top = (row: string) =>
      Number(row.match(/<w:tcMar><w:top w:type="dxa" w:w="(\d+)"\/>/)?.[1]);
    const bottom = (row: string) =>
      Number(row.match(/<w:tcMar>.*?<w:bottom w:type="dxa" w:w="(\d+)"\/>/)?.[1]);
    const cantSplit = /<w:cantSplit(\/>| w:val="(true|1|on)")/;
    for (const row of [whole, head, body, tail]) expect(row).toMatch(cantSplit);
    expect(whole).toContain("{{#jobRoles}}");
    expect(whole).toContain("{{#parts}}");
    expect(tail).toContain("{{/parts}}");
    expect(tail).toContain("{{/jobRoles}}");
    expect(whole).toMatch(/<w:bottom [^>]*w:val="single"/);
    expect(tail).toMatch(/<w:bottom [^>]*w:val="single"/);
    expect(head).not.toMatch(/<w:bottom [^>]*w:val="single"/);
    expect(body).not.toMatch(/<w:bottom [^>]*w:val="single"/);
    expect([top(whole), bottom(whole)]).toEqual([50, 50]);
    expect([top(head), bottom(head)]).toEqual([50, 0]);
    expect([top(body), bottom(body)]).toEqual([0, 0]);
    expect([top(tail), bottom(tail)]).toEqual([0, 50]);
    expect(tableOf(template.document, "{{#parts}}")).toMatch(
      /<w:insideH [^>]*w:val="none"/,
    );
    expect(template.document).not.toContain("keepWhole");
    expect(template.document).not.toContain("{{#last}}");
  });

  it("contrato sem valor mostra 'Não informado' na própria linha", () => {
    const line = para("{{contract.number}}");
    expect(line).toContain("{{^contract.number}}");
    expect(line).toContain("Não informado");
  });

  it("perguntas da hierarquia de medidas não deixam a última palavra sozinha", () => {
    const xml = template.document;
    expect(xml).toContain("fatores de\u00A0risco?");
    expect(xml).toContain("proteção\u00A0coletiva?");
    expect(xml).toContain("organização do\u00A0trabalho?");
    expect(xml).toContain("proteção\u00A0individual?");
  });

  it("plano de ação não usa mescla vertical e o rótulo do risco fica na linha de valores", async () => {
    const { document } = await build("template");
    const table = tableOf(document, "{{#actions}}");
    expect(table).not.toContain("w:vMerge");
    expect(rowOf(table, "{{riskRef}}")).toContain("{{occupationalRisk}}");
  });

  it("medidas de controle mesclam a coluna do risco nas quatro linhas", async () => {
    const { document } = await build("template");
    const table = tableOf(document, "{{#measures}}");
    expect(table.match(/<w:vMerge w:val="restart"\/>/g)).toHaveLength(1);
    expect(table.match(/<w:vMerge w:val="continue"\/>/g)).toHaveLength(3);
    expect(rowOf(table, "{{riskName}}")).toContain("{{elimination.measures}}");
  });

  it("espaçador entre tabelas tem altura exata de 6 pt", async () => {
    const { document } = await build("template");
    const spacers =
      document.match(
        /<w:spacing (?=[^>]*w:line="120")(?=[^>]*w:lineRule="exact")[^>]*\/>/g,
      ) ?? [];
    expect(spacers.length).toBeGreaterThanOrEqual(4);
  });

  it("PGR sem GES mostra o vazio em itálico e fecha com parágrafo vazio de 1 pt", () => {
    const message = para("Nenhum GES cadastrado neste PGR.");
    expect(message).toContain("<w:i/>");
    const start = template.document.indexOf("Nenhum GES cadastrado neste PGR.");
    const end = template.document.indexOf("{{/ges}}", start);
    const tail = template.document.slice(start, end);
    expect(tail).toContain('w:line="20"');
    expect(tail).toContain('w:lineRule="exact"');
  });
  it("cabeçalho de tabela usa fundo suave com texto e filete indigo, e repete na quebra", () => {
    const markers = [
      "{{labels.revisionNumber}}",
      "{{labels.jobRoleName}}",
      "Controle de risco e suas hierarquias",
      "Risco (Ref.)",
      "Responsável",
    ];
    for (const marker of markers) {
      const row = rowOf(template.document, marker);
      expect(row).toContain("<w:tblHeader");
      expect(row).toContain('w:fill="EEF0FE"');
      expect(row).not.toContain('w:fill="5B63F5"');
      expect(row).toContain('<w:color w:val="4F46E5"/>');
      expect(row).toMatch(/<w:bottom w:val="single" w:color="5B63F5" w:sz="12"\/>/);
    }
  });

  it("títulos das tabelas de metodologia seguem o mesmo cabeçalho suave", () => {
    const need = rowOf(template.document, "{{labels.controlNeedTable}}");
    expect(need).not.toContain('w:fill="5B63F5"');
    const probability = rowOf(template.document, "{{labels.probabilityQuantTable}}");
    expect(probability).toContain('w:fill="EEF0FE"');
    expect(probability).not.toContain('w:fill="5B63F5"');
  });

  it("capa é montada com elementos nativos, sem imagem de fundo", () => {
    expect(template.document).not.toContain("pgr-cover-background");
    const band = tableOf(template.document, "{{labels.documentTitle}}");
    expect(band).toContain('w:fill="5B63F5"');
    expect(band).toContain("{{labels.documentSubtitle}}");
    expect(band.indexOf('w:fill="4F46E5"')).toBeGreaterThan(
      band.indexOf("{{labels.documentSubtitle}}"),
    );
    expect(template.document.indexOf("{{@cover.validityXml}}")).toBeGreaterThan(
      template.document.indexOf("{{labels.documentSubtitle}}"),
    );
  });

  it("cartão de risco marca o agente por filete lateral e selo, sem faixa sólida", () => {
    const chemical = rowOf(template.document, "{{#agent.chemical}}");
    expect(chemical).toMatch(/<w:left w:val="single" w:color="8B5CF6" w:sz="48"\/>/);
    expect(chemical).toContain('w:fill="F6F6F9"');
    expect(chemical).not.toMatch(/<w:tcPr>(?:(?!<\/w:tcPr>).)*w:fill="8B5CF6"/);
    expect(chemical).toMatch(/<w:rPr>(?:(?!<\/w:rPr>).)*w:fill="8B5CF6"/);
    expect(chemical).toContain("{{agentType}}");
    expect(chemical).toContain("{{/agent.chemical}}");
  });

  it("cada GES abre com barra indigo própria, diferente do título de seção", () => {
    const inventory = template.document.slice(template.document.indexOf("{{#ges}}"));
    const gesTitle = paragraphOf(inventory, "{{title}}");
    expect(gesTitle).toContain('w:fill="5B63F5"');
    expect(gesTitle).toContain('<w:color w:val="FFFFFF"/>');
    expect(para("{{titles.introduction}}")).toContain('w:fill="EEF0FE"');
  });
});
