import PizZip from "pizzip";

import { inspectDocx } from "@/shared/integrations/docx/inspect";

function docx(body: string): Buffer {
  const zip = new PizZip();
  zip.file("word/document.xml", `<w:document><w:body>${body}</w:body></w:document>`);
  return zip.generate({ type: "nodebuffer" });
}

const row = (text: string, header = false) =>
  `<w:tr>${header ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}<w:tc><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc></w:tr>`;
const table = (rows: string[]) => `<w:tbl>${rows.join("")}</w:tbl>`;
const paragraph = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;

describe("inspectDocx", () => {
  it("conta linhas e cabeçalhos repetíveis de cada tabela, pelo texto da primeira linha", () => {
    const report = inspectDocx(
      docx(
        table([row("Função", true), row("Pedreiro"), row("Servente")]) +
          table([row("solta")]),
      ),
    );
    expect(report.tables).toEqual([
      { firstRowText: "Função", rows: 3, repeatedHeaderRows: 1 },
      { firstRowText: "solta", rows: 1, repeatedHeaderRows: 0 },
    ]);
  });

  it("tabela aninhada não entra na contagem de linhas da tabela de fora", () => {
    const nested = `<w:tr><w:tc>${table([row("dentro"), row("dentro 2")])}<w:p/></w:tc></w:tr>`;
    const report = inspectDocx(docx(table([row("Fora", true), nested])));
    expect(report.tables.map((item) => item.rows)).toEqual([2, 2]);
  });

  it("aponta marcador sobrando e valor vazio impresso como texto", () => {
    const report = inspectDocx(
      docx(
        paragraph("Empresa: undefined") +
          paragraph("Contrato: null") +
          paragraph("Total: NaN") +
          paragraph("Dado: [object Object]") +
          paragraph("{{company.cnpj}}"),
      ),
    );
    expect(report.leftoverMarkers).toEqual(["{{company.cnpj}}"]);
    expect(report.blankLiterals).toEqual(["undefined", "null", "NaN", "[object Object]"]);
  });

  it("palavra comum que contém 'null' não é falso positivo", () => {
    const report = inspectDocx(
      docx(paragraph("Contrato anulável e nullidade indefinida")),
    );
    expect(report.blankLiterals).toEqual([]);
    expect(report.leftoverMarkers).toEqual([]);
  });
});
