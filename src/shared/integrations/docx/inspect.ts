import PizZip from "pizzip";

import { extractDocxText, findLeftoverMarkers } from "./template-engine";

export type DocxTableReport = {
  firstRowText: string;
  rows: number;
  repeatedHeaderRows: number;
};

export type DocxReport = {
  tables: DocxTableReport[];
  leftoverMarkers: string[];
  blankLiterals: string[];
};

const BLANK_LITERALS = [
  { literal: "undefined", pattern: /(?<![\p{L}\p{N}_])undefined(?![\p{L}\p{N}_])/u },
  { literal: "null", pattern: /(?<![\p{L}\p{N}_])null(?![\p{L}\p{N}_])/u },
  { literal: "NaN", pattern: /(?<![\p{L}\p{N}_])NaN(?![\p{L}\p{N}_])/u },
  { literal: "[object Object]", pattern: /\[object Object\]/ },
];

const TABLE_TOKEN = /<w:tbl>|<\/w:tbl>|<w:tr[ >]|<\/w:tr>/g;

const plainText = (xml: string) => xml.replace(/<[^>]+>/g, "").trim();

type OpenTable = { rows: number; headers: number; firstRow: string; rowStart: number };

function tableReports(xml: string): DocxTableReport[] {
  const reports: { at: number; report: DocxTableReport }[] = [];
  const stack: (OpenTable & { at: number })[] = [];
  for (const match of xml.matchAll(TABLE_TOKEN)) {
    const token = match[0];
    const at = match.index;
    const current = stack[stack.length - 1];
    if (token === "<w:tbl>") {
      stack.push({ at, rows: 0, headers: 0, firstRow: "", rowStart: -1 });
    } else if (token === "</w:tbl>" && current) {
      stack.pop();
      reports.push({
        at: current.at,
        report: {
          firstRowText: current.firstRow,
          rows: current.rows,
          repeatedHeaderRows: current.headers,
        },
      });
    } else if (token === "</w:tr>" && current) {
      const rowXml = xml.slice(current.rowStart, at);
      if (current.rows === 0) current.firstRow = plainText(rowXml);
      current.rows += 1;
      current.headers += /<w:trPr>(?:(?!<\/w:trPr>).)*<w:tblHeader/.test(rowXml) ? 1 : 0;
    } else if (current) {
      current.rowStart = at;
    }
  }
  return reports.sort((a, b) => a.at - b.at).map((item) => item.report);
}

export function inspectDocx(docx: Buffer): DocxReport {
  const body = new PizZip(docx).file("word/document.xml")?.asText() ?? "";
  const text = extractDocxText(docx);
  return {
    tables: tableReports(body),
    leftoverMarkers: findLeftoverMarkers(text),
    blankLiterals: BLANK_LITERALS.filter((item) => item.pattern.test(text)).map(
      (item) => item.literal,
    ),
  };
}
