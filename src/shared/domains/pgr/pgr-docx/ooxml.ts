import { PGR_DOCX_COLORS, PGR_DOCX_FONT, PGR_DOCX_SIZES } from "./theme";

/**
 * Mini-construtor de WordprocessingML para os blocos que o código injeta no template
 * por tag crua (`{{@...}}` no docxtemplater): texto rico semi-fixo, matriz de
 * treinamento, matriz de risco e cronograma de campanhas. Só strings — sem dependência
 * de lib de DOCX em runtime. Os `w:pStyle` referenciam os estilos que o gerador do
 * template declara (`PGR_DOCX_STYLE_IDS`).
 */

/** IDs dos estilos de parágrafo declarados no template (`scripts/pgr-docx`). */
export const PGR_DOCX_STYLE_IDS = {
  body: "PgrBody",
  item: "PgrItem",
  subtitle: "PgrSubtitle",
  tableText: "PgrTableText",
} as const;

/** Largura útil da página A4 com as margens do template, em twips (dxa). */
export const PGR_DOCX_CONTENT_WIDTH = 10466;

export function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type RunOptions = {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  /** Meio-ponto (OOXML). */
  size?: number;
  /** Fundo do trecho (anotação do template: amarelo = fixo, laranja = semi-fixo). */
  shading?: string;
};

/** Um `w:r`. Quebras de linha (`\n`) viram `w:br`. */
export function run(text: string, options: RunOptions = {}): string {
  const props = [
    `<w:rFonts w:ascii="${PGR_DOCX_FONT}" w:hAnsi="${PGR_DOCX_FONT}" w:cs="${PGR_DOCX_FONT}"/>`,
    options.bold ? "<w:b/><w:bCs/>" : "",
    options.italic ? "<w:i/><w:iCs/>" : "",
    options.color ? `<w:color w:val="${options.color}"/>` : "",
    options.size
      ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>`
      : "",
    options.shading
      ? `<w:shd w:val="clear" w:color="auto" w:fill="${options.shading}"/>`
      : "",
  ].join("");
  const content = text
    .split("\n")
    .map((line) => `<w:t xml:space="preserve">${xmlEscape(line)}</w:t>`)
    .join("<w:br/>");
  return `<w:r><w:rPr>${props}</w:rPr>${content}</w:r>`;
}

/**
 * Trechos com `**negrito**` → runs. Marcadores desbalanceados ficam como texto.
 */
export function richRuns(text: string, options: RunOptions = {}): string {
  const parts = text.split("**");
  if (parts.length % 2 === 0) return run(text, options);
  return parts
    .map((part, index) =>
      part ? run(part, index % 2 === 1 ? { ...options, bold: true } : options) : "",
    )
    .join("");
}

export type ParagraphOptions = {
  style?: string;
  align?: "left" | "center" | "right" | "both";
  /** Espaço depois, em twips. */
  after?: number;
  before?: number;
  keepNext?: boolean;
  /** Recuo à esquerda em twips (sobrepõe o do estilo). */
  indent?: number;
};

export function paragraph(runs: string, options: ParagraphOptions = {}): string {
  const props = [
    options.style ? `<w:pStyle w:val="${options.style}"/>` : "",
    options.keepNext ? "<w:keepNext/>" : "",
    options.before !== undefined || options.after !== undefined
      ? `<w:spacing${options.before !== undefined ? ` w:before="${options.before}"` : ""}${
          options.after !== undefined ? ` w:after="${options.after}"` : ""
        }/>`
      : "",
    options.indent !== undefined ? `<w:ind w:left="${options.indent}"/>` : "",
    options.align ? `<w:jc w:val="${options.align}"/>` : "",
  ].join("");
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ""}${runs}</w:p>`;
}

export type CellOptions = {
  width: number;
  fill?: string;
  gridSpan?: number;
  vMerge?: "restart" | "continue";
  vAlign?: "top" | "center" | "bottom";
};

/** `w:tc`. `content` são parágrafos prontos — célula OOXML exige ao menos um `w:p`. */
export function cell(content: string, options: CellOptions): string {
  const props = [
    `<w:tcW w:w="${options.width}" w:type="dxa"/>`,
    options.gridSpan && options.gridSpan > 1
      ? `<w:gridSpan w:val="${options.gridSpan}"/>`
      : "",
    options.vMerge ? `<w:vMerge w:val="${options.vMerge}"/>` : "",
    options.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${options.fill}"/>` : "",
    `<w:vAlign w:val="${options.vAlign ?? "center"}"/>`,
  ].join("");
  return `<w:tc><w:tcPr>${props}</w:tcPr>${content || paragraph("")}</w:tc>`;
}

export function row(
  cells: string[],
  options: { header?: boolean; cantSplit?: boolean } = {},
) {
  const props = [
    options.cantSplit !== false ? "<w:cantSplit/>" : "",
    options.header ? "<w:tblHeader/>" : "",
  ].join("");
  return `<w:tr>${props ? `<w:trPr>${props}</w:trPr>` : ""}${cells.join("")}</w:tr>`;
}

/** Tabela com bordas finas na cor do design system e margens internas compactas. */
export function table(
  rows: string[],
  widths: number[],
  borderColor: string = PGR_DOCX_COLORS.border,
) {
  const border = (side: string) =>
    `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="${borderColor}"/>`;
  const total = widths.reduce((sum, w) => sum + w, 0);
  return [
    "<w:tbl>",
    "<w:tblPr>",
    `<w:tblW w:w="${total}" w:type="dxa"/>`,
    '<w:jc w:val="center"/>',
    `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(border).join("")}</w:tblBorders>`,
    '<w:tblLayout w:type="fixed"/>',
    '<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar>',
    "</w:tblPr>",
    `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`,
    ...rows,
    "</w:tbl>",
  ].join("");
}

/** Parágrafo de célula de tabela no tamanho/estilo padrão das tabelas do PGR. */
export function cellParagraph(
  text: string,
  options: RunOptions & Pick<ParagraphOptions, "align" | "keepNext"> = {},
): string {
  const { align, keepNext, ...runOptions } = options;
  return paragraph(richRuns(text, { size: PGR_DOCX_SIZES.table, ...runOptions }), {
    style: PGR_DOCX_STYLE_IDS.tableText,
    align,
    keepNext,
  });
}
