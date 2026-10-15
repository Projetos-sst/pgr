import type { ClassificationBand } from "@/shared/domains/pgr/methodology";
import {
  campaignsXml,
  riskMatrixXml,
  trainingMatrixXml,
} from "@/shared/domains/pgr/pgr-docx/blocks";
import { DEFAULT_METHODOLOGY } from "@/shared/domains/pgr/pgr-docx/defaults";
import { cellParagraph, paragraph } from "@/shared/domains/pgr/pgr-docx/ooxml";
import { riskBandMatrix, riskBandRanges } from "@/shared/domains/pgr/pgr-docx/risk-bands";
import { textWidth } from "@/shared/domains/pgr/pgr-docx/text-fit";
import {
  PGR_DOCX_RISK_CLASS_COLORS,
  PGR_DOCX_RISK_CLASSES,
  PGR_DOCX_RISK_MATRIX,
  type PgrDocxRiskClass,
} from "@/shared/domains/pgr/pgr-docx/theme";

const labels = {
  probability: "PROBABILIDADE",
  severity: "SEVERIDADE",
  legend: "Legenda",
};

const fundacentro: ClassificationBand[] = [
  { classification: "trivial", maxLevel: 2 },
  { classification: "tolerable", maxLevel: 6 },
  { classification: "moderate", maxLevel: 12 },
  { classification: "substantial", maxLevel: 20 },
  { classification: "intolerable", maxLevel: 25 },
];

const rows = (xml: string) => xml.split("<w:tr>").slice(1);
const cells = (rowXml: string) => rowXml.match(/<w:tc>.*?<\/w:tc>/g) ?? [];
const fill = (cellXml: string) => cellXml.match(/<w:tcPr>.*?w:fill="([0-9A-F]{6})"/)?.[1];
const text = (cellXml = "") => cellXml.replace(/<[^>]+>/g, "");

function matrixFills(xml: string) {
  return rows(xml)
    .slice(3, 8)
    .map((row) => cells(row).slice(3).map(fill));
}

function legend(xml: string) {
  return rows(xml)
    .slice(-5)
    .map((row) => {
      const [range, , label] = cells(row);
      return [text(range), text(label)];
    });
}

const strong = (matrix: readonly (readonly PgrDocxRiskClass[])[]) =>
  matrix.map((row) =>
    row.map((riskClass) => PGR_DOCX_RISK_CLASS_COLORS[riskClass].strong),
  );

describe("riskMatrixXml", () => {
  it("sem faixas: matriz e legenda de referência", () => {
    const xml = riskMatrixXml(DEFAULT_METHODOLOGY.matrix, labels);
    expect(matrixFills(xml)).toEqual(strong(PGR_DOCX_RISK_MATRIX));
    expect(legend(xml)).toEqual(
      PGR_DOCX_RISK_CLASSES.map((riskClass) => [
        PGR_DOCX_RISK_CLASS_COLORS[riskClass].range,
        PGR_DOCX_RISK_CLASS_COLORS[riskClass].label,
      ]),
    );
  });

  it("com faixas: cada célula na cor da classe do nível e legenda sem sobreposição", () => {
    const xml = riskMatrixXml(DEFAULT_METHODOLOGY.matrix, labels, {
      matrix: riskBandMatrix(fundacentro),
      ranges: riskBandRanges(fundacentro),
    });
    expect(matrixFills(xml)).toEqual(
      strong([
        ["tolerable", "moderate", "substantial", "substantial", "intolerable"],
        ["tolerable", "moderate", "moderate", "substantial", "substantial"],
        ["tolerable", "tolerable", "moderate", "moderate", "substantial"],
        ["trivial", "tolerable", "tolerable", "moderate", "moderate"],
        ["trivial", "trivial", "tolerable", "tolerable", "tolerable"],
      ]),
    );
    expect(legend(xml)).toEqual([
      ["1-2", "Trivial"],
      ["3-6", "Tolerável"],
      ["7-12", "Moderado"],
      ["13-20", "Substancial"],
      ["21-25", "Intolerável"],
    ]);
  });

  it("números das células seguem probabilidade × severidade", () => {
    const xml = riskMatrixXml(DEFAULT_METHODOLOGY.matrix, labels);
    const levels = rows(xml)
      .slice(3, 8)
      .map((row) => cells(row).slice(3).map(text));
    expect(levels[0]).toEqual(["5", "10", "15", "20", "25"]);
    expect(levels[4]).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("todas as linhas, menos a última, têm keepNext em todos os parágrafos", () => {
    const all = rows(riskMatrixXml(DEFAULT_METHODOLOGY.matrix, labels));
    for (const row of all.slice(0, -1)) {
      for (const paragraph of row.split("<w:p>").slice(1)) {
        expect(paragraph).toContain("<w:keepNext/>");
      }
    }
    for (const paragraph of all[all.length - 1].split("<w:p>").slice(1)) {
      expect(paragraph).not.toContain("<w:keepNext/>");
    }
  });
});

const tablesOf = (xml: string) => xml.split("<w:tbl>").slice(1);
const gridOf = (xml: string) =>
  (xml.match(/<w:tblGrid>.*?<\/w:tblGrid>/)?.[0] ?? "").match(/\d+/g)?.map(Number) ?? [];
const plainText = (xml: string) => xml.replace(/<[^>]+>/g, "");
const firstCell = (xml: string) => xml.split("<w:tc>")[1].split("</w:tc>")[0];

const trainingLabels = { index: "Nº", role: "FUNÇÃO", empty: "Nenhum treinamento." };
const training = (columns: string[], names: string[]) => ({
  columns,
  rows: names.map((name, index) => ({
    name,
    marks: columns.map((_, column) => (column + index) % 2 === 0),
  })),
});

describe("trainingMatrixXml", () => {
  it("coluna FUNÇÃO acompanha o maior nome, entre 2300 e 4200 dxa", () => {
    const short = trainingMatrixXml(training(["NR 06"], ["Eletricista"]), trainingLabels);
    expect(gridOf(short)[1]).toBe(2300);

    const medium = "Operador de empilhadeira elétrica";
    const mediumXml = trainingMatrixXml(training(["NR 11"], [medium]), trainingLabels);
    expect(gridOf(mediumXml)[1]).toBe(
      Math.min(4200, Math.max(2300, Math.ceil(textWidth(medium, 15, true) + 160))),
    );

    const huge = `${medium} do setor de expedição noturno e de fim de semana da unidade industrial`;
    const hugeXml = trainingMatrixXml(training(["NR 11"], [huge]), trainingLabels);
    expect(gridOf(hugeXml)[1]).toBe(4200);
  });

  it("15 colunas com rótulos longos usam cabeçalho vertical e altura mínima", () => {
    const columns = Array.from(
      { length: 15 },
      (_, index) => `Treinamento NR ${index + 1} de segurança`,
    );
    const xml = trainingMatrixXml(
      training(columns, ["Eletricista", "Soldador"]),
      trainingLabels,
    );
    expect(tablesOf(xml)).toHaveLength(1);
    expect(xml.match(/w:textDirection w:val="btLr"/g)).toHaveLength(15);
    const height = Number(
      xml.match(/<w:trHeight w:val="(\d+)" w:hRule="atLeast"\/>/)?.[1],
    );
    expect(height).toBeGreaterThanOrEqual(
      Math.max(...columns.map((label) => textWidth(label, 13, true))) + 200,
    );
    expect(tablesOf(xml)[0]).toContain("<w:tblHeader/>");
  });

  it("rótulos que cabem na horizontal não usam cabeçalho vertical", () => {
    const xml = trainingMatrixXml(
      training(["NR 06", "NR 35", "RAC 01"], ["Eletricista"]),
      trainingLabels,
    );
    expect(xml).not.toContain("btLr");
    expect(xml).not.toContain("w:trHeight");
  });

  it("acima de 20 colunas parte em blocos que repetem índice e função", () => {
    const columns = Array.from({ length: 30 }, (_, index) => `Treinamento ${index + 1}`);
    const xml = trainingMatrixXml(
      training(columns, ["Eletricista", "Soldador"]),
      trainingLabels,
    );
    const tables = tablesOf(xml);
    expect(tables).toHaveLength(2);
    expect(xml).toContain("</w:tbl><w:p>");
    for (const table of tables) {
      expect(plainText(table)).toContain("FUNÇÃO");
      expect(table).toContain("<w:tblHeader/>");
      expect(gridOf(table)).toHaveLength(17);
      expect(gridOf(table).reduce((sum, width) => sum + width, 0)).toBe(10466);
    }
    expect(plainText(tables[0])).toContain("Treinamento 1");
    expect(plainText(tables[1])).toContain("Treinamento 30");
  });

  it("cabeçalho da matriz fica preso à linha; com uma função só, a linha não leva keepNext", () => {
    const columns = Array.from(
      { length: 15 },
      (_, index) => `Treinamento NR ${index + 1} de segurança`,
    );
    const xmls = [
      trainingMatrixXml(training(columns, ["Eletricista"]), trainingLabels),
      trainingMatrixXml(
        training(["NR 06", "NR 35", "RAC 01"], ["Eletricista"]),
        trainingLabels,
      ),
    ];
    for (const xml of xmls) {
      const trs = xml.match(/<w:tr>.*?<\/w:tr>/g) ?? [];
      expect(trs.length).toBeGreaterThan(1);
      const headerRow = trs[0] ?? "";
      const firstBodyRow = trs[1] ?? "";
      expect(headerRow).toContain("<w:tblHeader/>");
      const headerCells = headerRow.match(/<w:p>.*?<\/w:p>/g) ?? [];
      expect(headerCells.length).toBeGreaterThan(0);
      for (const cellXml of headerCells) {
        expect(cellXml).toContain("<w:keepNext/>");
      }
      expect(firstBodyRow).not.toContain("<w:keepNext/>");
    }
  });

  it("cabeçalho vertical tem altura máxima mesmo com rótulo muito longo", () => {
    const longLabel =
      "Segurança em Instalações e Serviços em Eletricidade - Básico NR-10 (40h) com reciclagem bienal obrigatória para eletricistas, encarregados e supervisores de manutenção predial e industrial";
    const xml = trainingMatrixXml(
      training(
        ["NR 06", "NR 18", "NR 35", "NR 12", "RAC 01", "NR 33", longLabel],
        ["Eletricista", "Soldador"],
      ),
      trainingLabels,
    );
    const headerRow = xml.match(/<w:tr>.*?<\/w:tr>/)?.[0] ?? "";
    const height = Number(headerRow.match(/<w:trHeight w:val="(\d+)"/)?.[1]);
    expect(height).toBeLessThanOrEqual(2600);
    expect(headerRow).toContain("<w:br/>");
    expect(headerRow).toContain("…");
    const headerCells = headerRow.match(/<w:tc>.*?<\/w:tc>/g) ?? [];
    const longCell =
      headerCells.find((cellXml) => cellXml.includes("Segurança em Instalações")) ?? "";
    const width = Number(longCell.match(/<w:tcW w:w="(\d+)"/)?.[1]);
    expect(longCell.split("<w:br/>").length).toBeLessThanOrEqual(
      Math.max(1, Math.floor((width - 140) / 200)),
    );
  });

  it("rótulos curtos continuam numa linha só e a altura não muda", () => {
    const short = ["NR 06", "NR 18", "NR 35"];
    const columns = Array.from({ length: 40 }, (_, index) => short[index % short.length]);
    const xml = trainingMatrixXml(training(columns, ["Eletricista"]), trainingLabels);
    expect(xml).toContain("btLr");
    const headerRow = xml.match(/<w:tr>.*?<\/w:tr>/)?.[0] ?? "";
    expect(headerRow).not.toContain("<w:br/>");
    expect(headerRow).not.toContain("…");
    const expected = Math.ceil(
      Math.max(...short.map((label) => textWidth(label, 13, true))) + 200,
    );
    expect(headerRow).toContain(`<w:trHeight w:val="${expected}" w:hRule="atLeast"/>`);
  });

  it("rótulo longo em coluna larga sai inteiro no cabeçalho vertical", () => {
    const longLabel =
      "Segurança em Instalações e Serviços em Eletricidade - Básico NR-10 (40h) com reciclagem bienal obrigatória para eletricistas";
    const xml = trainingMatrixXml(
      training(
        ["NR 06", "NR 18", "NR 35", "NR 12", longLabel],
        [
          "Encarregado de obras",
          "Pedreiro",
          "Servente",
          "Técnico de segurança do trabalho",
        ],
      ),
      trainingLabels,
    );
    expect(xml).toContain("btLr");
    const headerRow = xml.match(/<w:tr>.*?<\/w:tr>/)?.[0] ?? "";
    expect(headerRow).not.toContain("…");
    const headerCells = headerRow.match(/<w:tc>.*?<\/w:tc>/g) ?? [];
    const longCell =
      headerCells.find((cellXml) => cellXml.includes("Segurança em Instalações")) ?? "";
    const width = Number(longCell.match(/<w:tcW w:w="(\d+)"/)?.[1]);
    const height = Number(headerRow.match(/<w:trHeight w:val="(\d+)"/)?.[1]);
    expect(plainText(longCell)).toContain("NR-10");
    expect(plainText(longCell)).toContain("eletricistas");
    expect(longCell.split("<w:br/>").length).toBeGreaterThanOrEqual(2);
    expect(longCell.split("<w:br/>").length).toBeLessThanOrEqual(
      Math.floor((width - 140) / 200),
    );
    expect(height).toBeLessThanOrEqual(2600);
  });

  it("rótulo longo em coluna estreita fica numa linha só, com reticências", () => {
    const longLabel =
      "Segurança em Instalações e Serviços em Eletricidade - Básico NR-10 (40h) com reciclagem bienal obrigatória para eletricistas";
    const columns = [
      ...Array.from(
        { length: 15 },
        (_, index) => `NR ${String(index + 1).padStart(2, "0")}`,
      ),
      longLabel,
    ];
    const xml = trainingMatrixXml(
      training(columns, ["Eletricista", "Soldador"]),
      trainingLabels,
    );
    expect(xml).toContain("btLr");
    const headerRow = xml.match(/<w:tr>.*?<\/w:tr>/)?.[0] ?? "";
    const headerCells = headerRow.match(/<w:tc>.*?<\/w:tc>/g) ?? [];
    const longCell =
      headerCells.find((cellXml) => cellXml.includes("Segurança em Instalações")) ?? "";
    expect(longCell).not.toContain("<w:br/>");
    expect(plainText(longCell)).toContain("…");
    expect(textWidth(plainText(longCell), 13, true)).toBeLessThanOrEqual(2400);
  });

  it("linhas do corpo: só a primeira e a penúltima ficam presas à seguinte, inclusive com duas funções", () => {
    const xml = trainingMatrixXml(
      training(["NR 06", "NR 35", "RAC 01"], ["A", "B", "C", "D", "E"]),
      trainingLabels,
    );
    const trs = xml.match(/<w:tr>.*?<\/w:tr>/g) ?? [];
    const body = trs.filter((tr) => !tr.includes("<w:tblHeader/>"));
    expect(body.map((tr) => tr.includes("<w:keepNext/>"))).toEqual([
      true,
      false,
      false,
      true,
      false,
    ]);
    const pair = trainingMatrixXml(
      training(["NR 06", "NR 35", "RAC 01"], ["A", "B"]),
      trainingLabels,
    );
    const pairBody = (pair.match(/<w:tr>.*?<\/w:tr>/g) ?? []).filter(
      (tr) => !tr.includes("<w:tblHeader/>"),
    );
    expect(pairBody.map((tr) => tr.includes("<w:keepNext/>"))).toEqual([true, false]);
  });
});

describe("campaignsXml", () => {
  const labels = { actions: "AÇÕES RECOMENDADAS" };
  const campaign = (theme: string, actions: string) => ({
    month: "Março",
    theme,
    actions,
  });
  const limit = Math.floor(10466 / 4) - 140;

  it("cabeçalho de campanha que cabe mantém o tamanho do tema", () => {
    const xml = campaignsXml(
      [campaign("Março Lilás", "Palestra sobre saúde mental")],
      labels,
    );
    expect(firstCell(xml).match(/<w:sz w:val="(\d+)"/)?.[1]).toBe("15");
  });

  it("cabeçalho de campanha longo fica em 15 e quebra em 2 linhas equilibradas", () => {
    const theme = "27 de julho – Dia Nacional de Prevenção de Acidentes";
    const xml = campaignsXml([campaign(theme, "Palestra")], labels);
    const head = firstCell(xml);
    const sizes = head.match(/<w:sz w:val="\d+"\/>/g) ?? [];
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) expect(size).toBe('<w:sz w:val="15"/>');
    expect(head.match(/<w:br\/>/g)).toHaveLength(1);
    const lines = head.split("<w:br/>").map(plainText);
    for (const line of lines) {
      expect(textWidth(line, 15, true)).toBeLessThanOrEqual(limit);
    }
    expect(lines[lines.length - 1].trim().split(" ").length).toBeGreaterThanOrEqual(2);
  });

  it("item curto sai numa linha só, sem quebra no parágrafo", () => {
    const xml = campaignsXml(
      [campaign("Março Lilás", "Palestra sobre saúde mental")],
      labels,
    );
    const itemPattern =
      /<w:p>(?:(?!<\/w:p>).)*Palestra sobre saúde mental(?:(?!<\/w:p>).)*<\/w:p>/;
    const item = xml.match(itemPattern)?.[0] ?? "";
    expect(plainText(item)).toBe("• Palestra sobre saúde mental");
    expect(item).not.toContain("<w:br/>");
  });

  it("item longo quebra em linhas equilibradas e nunca termina com uma palavra só", () => {
    const action =
      "Realizar inspeção semanal dos extintores de incêndio do setor de produção, registrando as não conformidades no livro de controle e comunicando a chefia imediata";
    const xml = campaignsXml([campaign("Abril Verde", action)], labels);
    const itemPattern = /<w:p>(?:(?!<\/w:p>).)*Realizar(?:(?!<\/w:p>).)*<\/w:p>/;
    const item = xml.match(itemPattern)?.[0] ?? "";
    const indent = Math.ceil(textWidth("• ", 13));
    expect(item).toContain(`<w:ind w:left="${indent}" w:hanging="${indent}"/>`);
    const lines = item.split("<w:br/>").map(plainText);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].startsWith("• ")).toBe(true);
    const bodies = lines.map((line, index) => (index === 0 ? line.slice(2) : line));
    for (const body of bodies) {
      expect(textWidth(body, 13)).toBeLessThanOrEqual(limit - indent);
    }
    expect(bodies[bodies.length - 1].trim().split(" ").length).toBeGreaterThanOrEqual(2);
    expect(lines.join(" ")).toBe(`• ${action}`);
  });

  it("grade que quebra prende cada linha à seguinte, exceto as ações do último bloco", () => {
    const xml = campaignsXml(
      [
        campaign("Março Lilás", "Palestra; Cartaz"),
        campaign("Abril Verde", "Palestra; Cartaz"),
        campaign("Maio Amarelo", "Palestra; Cartaz"),
        campaign("Junho Azul", "Palestra; Cartaz"),
        campaign("Julho Laranja", "Palestra; Cartaz"),
      ],
      labels,
    );
    const grid = xml.split("</w:tr>").filter((part) => part.includes("<w:tr"));
    expect(grid).toHaveLength(4);
    for (const part of grid.slice(0, 3)) {
      const content = part.replace(/<w:p><\/w:p>/g, "");
      const paragraphs = content.match(/<w:p[ >]/g)?.length ?? 0;
      expect(paragraphs).toBeGreaterThan(0);
      expect(content.match(/<w:keepNext\/>/g)?.length ?? 0).toBe(paragraphs);
    }
    expect(grid[3]).not.toContain("<w:keepNext/>");
    for (const part of grid) expect(part).toContain("<w:cantSplit/>");
  });

  it("bloco único com 4 campanhas não prende as ações ao que vem depois", () => {
    const xml = campaignsXml(
      [
        campaign("Março Lilás", "Palestra; Cartaz"),
        campaign("Abril Verde", "Palestra; Cartaz"),
        campaign("Maio Amarelo", "Palestra; Cartaz"),
        campaign("Junho Azul", "Palestra; Cartaz"),
      ],
      labels,
    );
    const grid = xml.split("</w:tr>").filter((part) => part.includes("<w:tr"));
    expect(grid).toHaveLength(2);
    expect(grid[0]).toContain("<w:keepNext/>");
    expect(grid[1]).not.toContain("<w:keepNext/>");
  });
});

describe("recuo de parágrafo", () => {
  it("recuo pendurado vai como left e hanging", () => {
    expect(cellParagraph("x", { indent: 120, hanging: 120 })).toContain(
      '<w:ind w:left="120" w:hanging="120"/>',
    );
  });

  it("recuo sem pendurado vai só como left", () => {
    expect(paragraph("", { indent: 200 })).toContain('<w:ind w:left="200"/>');
  });
});
