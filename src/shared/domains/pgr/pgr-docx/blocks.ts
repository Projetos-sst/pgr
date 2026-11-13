import type { PgrDocxTrainingMatrix } from "./content";
import type { PgrDocxCampaign, PgrDocxMethodology } from "./defaults";
import {
  PGR_DOCX_CONTENT_WIDTH,
  cell,
  cellParagraph,
  paragraph,
  row,
  run,
  table,
  PGR_DOCX_STYLE_IDS,
} from "./ooxml";
import {
  PGR_DOCX_COLORS,
  PGR_DOCX_RISK_CLASS_COLORS,
  PGR_DOCX_RISK_CLASSES,
  PGR_DOCX_RISK_MATRIX,
  PGR_DOCX_SIZES,
  PGR_DOCX_TABLE_HEAD,
  type PgrDocxRiskClass,
} from "./theme";
import { balancedLines, textWidth } from "./text-fit";

/**
 * Blocos de tabela montados em código e injetados por tag crua (`{{@...}}`): têm
 * número de colunas variável (matriz de treinamento, campanhas) ou cor por célula
 * derivada dos dados (matriz de risco) — coisas que um loop de linha do docxtemplater
 * não expressa.
 */

const header = (text: string, width: number, extra: { gridSpan?: number } = {}) =>
  cell(
    cellParagraph(text, {
      bold: true,
      color: PGR_DOCX_TABLE_HEAD.text,
      size: PGR_DOCX_SIZES.tableSmall,
      align: "center",
      keepNext: true,
    }),
    { width, fill: PGR_DOCX_TABLE_HEAD.fill, ...extra },
  );

const verticalHeader = (text: string, width: number) => {
  const label = cellParagraph(text, {
    bold: true,
    color: PGR_DOCX_TABLE_HEAD.text,
    size: PGR_DOCX_SIZES.tableSmall,
    align: "center",
    keepNext: true,
  });
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${PGR_DOCX_TABLE_HEAD.fill}"/><w:textDirection w:val="btLr"/><w:vAlign w:val="center"/></w:tcPr>${label}</w:tc>`;
};

const TRAINING_MIN_MARK_WIDTH = 380;
const TRAINING_HEADER_MAX = 2600;
const TRAINING_LINE_HEIGHT = 200;
const CELL_TEXT_MARGIN = 140;

type TrainingPlacement = { column: number; width: number };

/** Seção 5 — funções × treinamentos obrigatórios ("X" quando aplicável). */
export function trainingMatrixXml(
  matrix: PgrDocxTrainingMatrix,
  labels: { index: string; role: string; empty: string },
  options: { shading?: string } = {},
): string {
  if (matrix.columns.length === 0 || matrix.rows.length === 0) {
    return paragraph(run(labels.empty, { italic: true, color: PGR_DOCX_COLORS.muted }), {
      style: PGR_DOCX_STYLE_IDS.body,
    });
  }
  const indexWidth = 420;
  const widest = matrix.rows.reduce(
    (max, item) => Math.max(max, textWidth(item.name, PGR_DOCX_SIZES.table, true)),
    0,
  );
  const roleWidth = Math.min(4200, Math.max(2300, Math.ceil(widest + 160)));
  const available = PGR_DOCX_CONTENT_WIDTH - indexWidth - roleWidth;
  const perBlock = Math.max(1, Math.floor(available / TRAINING_MIN_MARK_WIDTH));
  const blockCount = Math.ceil(matrix.columns.length / perBlock);
  const blockSize = Math.ceil(matrix.columns.length / blockCount);
  const blocks: TrainingPlacement[][] = [];
  for (let start = 0; start < matrix.columns.length; start += blockSize) {
    const columns = Array.from(
      { length: Math.min(blockSize, matrix.columns.length - start) },
      (_, position) => start + position,
    );
    const markWidths = splitWidth(available, columns.length);
    blocks.push(
      columns.map((column, position) => ({ column, width: markWidths[position] })),
    );
  }
  const labelWidth = (label: string) => textWidth(label, PGR_DOCX_SIZES.tableSmall, true);
  const vertical = blocks.some((block) =>
    block.some(({ column, width }) => labelWidth(matrix.columns[column]) + 160 > width),
  );
  const columnWidths = new Map(
    blocks.flat().map(({ column, width }) => [column, width] as const),
  );
  const fitted = matrix.columns.map((label, column) =>
    fitVerticalLabel(label, columnWidths.get(column) ?? TRAINING_MIN_MARK_WIDTH),
  );
  const widestLine = Math.max(
    ...fitted.flatMap((label) => label.split("\n").map((line) => labelWidth(line))),
  );
  const headerHeight = Math.min(TRAINING_HEADER_MAX, Math.ceil(widestLine + 200));
  const headerRow = (block: TrainingPlacement[]) => {
    const height = vertical
      ? `<w:trHeight w:val="${headerHeight}" w:hRule="atLeast"/>`
      : "";
    const cells = [
      header(labels.index, indexWidth),
      header(labels.role, roleWidth),
      ...block.map(({ column, width }) =>
        vertical
          ? verticalHeader(fitted[column], width)
          : header(matrix.columns[column], width),
      ),
    ];
    return `<w:tr><w:trPr><w:cantSplit/>${height}<w:tblHeader/></w:trPr>${cells.join("")}</w:tr>`;
  };
  const bodyRows = (block: TrainingPlacement[]) =>
    matrix.rows.map((item, index) => {
      const keepNext =
        matrix.rows.length >= 2 && (index === 0 || index === matrix.rows.length - 2);
      return row([
        cell(
          cellParagraph(String(index + 1), {
            size: PGR_DOCX_SIZES.tableSmall,
            align: "center",
            keepNext,
          }),
          {
            width: indexWidth,
            fill: index % 2 === 1 ? PGR_DOCX_COLORS.surfaceAlt : undefined,
          },
        ),
        cell(
          cellParagraph(item.name, {
            size: PGR_DOCX_SIZES.tableSmall,
            shading: options.shading,
            keepNext,
          }),
          {
            width: roleWidth,
            fill: index % 2 === 1 ? PGR_DOCX_COLORS.surfaceAlt : undefined,
          },
        ),
        ...block.map(({ column, width }) =>
          cell(
            cellParagraph(item.marks[column] ? "X" : "", {
              bold: true,
              color: PGR_DOCX_COLORS.primaryStrong,
              size: PGR_DOCX_SIZES.tableSmall,
              align: "center",
              keepNext,
            }),
            {
              width,
              fill: index % 2 === 1 ? PGR_DOCX_COLORS.surfaceAlt : undefined,
            },
          ),
        ),
      ]);
    });
  const spacer = paragraph("", { style: PGR_DOCX_STYLE_IDS.body, after: 120 });
  return blocks
    .map((block) =>
      table(
        [headerRow(block), ...bodyRows(block)],
        [indexWidth, roleWidth, ...block.map(({ width }) => width)],
      ),
    )
    .join(spacer);
}

function splitWidth(total: number, count: number): number[] {
  const width = Math.floor(total / count);
  return Array.from({ length: count }, (_, position) =>
    position === count - 1 ? total - width * (count - 1) : width,
  );
}

function fitVerticalLabel(label: string, width: number): string {
  const size = PGR_DOCX_SIZES.tableSmall;
  const limit = TRAINING_HEADER_MAX - 200;
  if (textWidth(label, size, true) <= limit) return label;
  const maxLines = Math.max(
    1,
    Math.floor((width - CELL_TEXT_MARGIN) / TRAINING_LINE_HEIGHT),
  );
  const lines = balancedLines(label, { size, width: limit, bold: true });
  if (lines.length <= maxLines) return lines.join("\n");
  const kept = lines.slice(0, maxLines - 1);
  const words = lines
    .slice(maxLines - 1)
    .join(" ")
    .split(" ");
  const fits = (count: number) =>
    textWidth(`${words.slice(0, count).join(" ")}…`, size, true) <= limit;
  let count = words.length;
  while (count > 1 && !fits(count)) count -= 1;
  return [...kept, `${words.slice(0, count).join(" ")}…`].join("\n");
}

/**
 * Seção 17 — matriz 5×5 (linhas = probabilidade 5→1, colunas = severidade 1→5), cada
 * célula com `P×S` na cor da classe, seguida da legenda das classes.
 */
export function riskMatrixXml(
  methodology: PgrDocxMethodology["matrix"],
  labels: { probability: string; severity: string; legend: string },
  scale: {
    matrix?: readonly (readonly PgrDocxRiskClass[])[];
    ranges?: Partial<Record<PgrDocxRiskClass, string>>;
  } = {},
): string {
  const matrix = scale.matrix ?? PGR_DOCX_RISK_MATRIX;
  const titleWidth = 1300;
  const probLabelWidth = 1500;
  const levelWidth = 600;
  const sevWidth = Math.floor(
    (PGR_DOCX_CONTENT_WIDTH - titleWidth - probLabelWidth - levelWidth) / 5,
  );
  const widths = [titleWidth, probLabelWidth, levelWidth, ...Array(5).fill(sevWidth)];
  const leftWidth = titleWidth + probLabelWidth + levelWidth;
  // keepNext em todas as células: a matriz + legenda não se partem entre páginas.
  const muted = (text: string, bold = false) =>
    cellParagraph(text, {
      bold,
      size: PGR_DOCX_SIZES.tableSmall,
      align: "center",
      keepNext: true,
    });
  const keptEmpty = () =>
    cellParagraph("", { size: PGR_DOCX_SIZES.tableSmall, keepNext: true });

  const head = [
    row([
      cell(
        cellParagraph(`**${methodology.title}**\n${methodology.subtitle}`, {
          size: PGR_DOCX_SIZES.tableSmall,
          align: "center",
          keepNext: true,
        }),
        {
          width: leftWidth,
          gridSpan: 3,
          vMerge: "restart",
          fill: PGR_DOCX_COLORS.primarySoft,
        },
      ),
      cell(muted(labels.severity, true), {
        width: sevWidth * 5,
        gridSpan: 5,
        fill: PGR_DOCX_COLORS.primarySoft,
      }),
    ]),
    row([
      cell(keptEmpty(), { width: leftWidth, gridSpan: 3, vMerge: "continue" }),
      ...methodology.severityLabels.map((label) =>
        cell(muted(label), { width: sevWidth, fill: PGR_DOCX_COLORS.surfaceAlt }),
      ),
    ]),
    row([
      cell(keptEmpty(), { width: leftWidth, gridSpan: 3, vMerge: "continue" }),
      ...[1, 2, 3, 4, 5].map((level) =>
        cell(muted(String(level), true), {
          width: sevWidth,
          fill: PGR_DOCX_COLORS.surfaceAlt,
        }),
      ),
    ]),
  ];

  const body = matrix.map((classes, index) => {
    const probability = 5 - index;
    return row([
      cell(index === 0 ? muted(labels.probability, true) : keptEmpty(), {
        width: titleWidth,
        vMerge: index === 0 ? "restart" : "continue",
        fill: PGR_DOCX_COLORS.primarySoft,
      }),
      cell(muted(methodology.probabilityLabels[probability - 1] ?? ""), {
        width: probLabelWidth,
        fill: PGR_DOCX_COLORS.surfaceAlt,
      }),
      cell(muted(String(probability), true), {
        width: levelWidth,
        fill: PGR_DOCX_COLORS.surfaceAlt,
      }),
      ...classes.map((riskClass, column) => {
        const colors = PGR_DOCX_RISK_CLASS_COLORS[riskClass];
        return cell(
          cellParagraph(String(probability * (column + 1)), {
            bold: true,
            color: colors.text,
            size: PGR_DOCX_SIZES.tableSmall,
            align: "center",
            keepNext: true,
          }),
          { width: sevWidth, fill: colors.strong },
        );
      }),
    ]);
  });

  const legendTitle = row([
    cell(muted(labels.legend, true), {
      width: PGR_DOCX_CONTENT_WIDTH,
      gridSpan: 8,
      fill: PGR_DOCX_COLORS.primarySoft,
    }),
  ]);
  const legend = PGR_DOCX_RISK_CLASSES.map((riskClass, index) => {
    const colors = PGR_DOCX_RISK_CLASS_COLORS[riskClass];
    const last = index === PGR_DOCX_RISK_CLASSES.length - 1;
    return row([
      cell(
        cellParagraph(scale.ranges?.[riskClass] ?? colors.range, {
          bold: true,
          size: PGR_DOCX_SIZES.tableSmall,
          align: "center",
          keepNext: !last,
        }),
        { width: titleWidth + probLabelWidth, gridSpan: 2 },
      ),
      cell(last ? cellParagraph("", { size: PGR_DOCX_SIZES.tableSmall }) : keptEmpty(), {
        width: levelWidth + sevWidth * 2,
        gridSpan: 3,
        fill: colors.strong,
      }),
      cell(
        cellParagraph(colors.label, {
          bold: true,
          color: colors.text,
          size: PGR_DOCX_SIZES.tableSmall,
          align: "center",
          keepNext: !last,
        }),
        { width: sevWidth * 3, gridSpan: 3, fill: colors.soft },
      ),
    ]);
  });

  return table([...head, ...body, legendTitle, ...legend], widths);
}

/** Cor do cartão de campanha pelo tema ("Abril Verde" → verde), na paleta do design system. */
export function campaignColors(theme: string): {
  fill: string;
  soft: string;
  text: string;
} {
  const value = theme.toLowerCase();
  if (value.includes("verde") || value.includes("acidentes"))
    return { fill: "16A34A", soft: "DCFCE7", text: "FFFFFF" };
  if (value.includes("amarelo"))
    return { fill: "F5A524", soft: "FEF9C3", text: "1B1F2E" };
  if (value.includes("lilás") || value.includes("lilas"))
    return { fill: "8B5CF6", soft: "EDE9FE", text: "FFFFFF" };
  if (value.includes("rosa")) return { fill: "EC4899", soft: "FCE7F3", text: "FFFFFF" };
  if (value.includes("azul")) return { fill: "0284C7", soft: "E0F2FE", text: "FFFFFF" };
  if (value.includes("branco"))
    return {
      fill: PGR_DOCX_COLORS.borderStrong,
      soft: PGR_DOCX_COLORS.surfaceAlt,
      text: "1B1F2E",
    };
  return {
    fill: PGR_DOCX_COLORS.primary,
    soft: PGR_DOCX_COLORS.primarySoft,
    text: PGR_DOCX_COLORS.white,
  };
}

/**
 * Seção 22 — cronograma anual como cartões lado a lado (até 4 por linha), cada um com
 * o tema colorido no topo e as ações recomendadas embaixo.
 */
export function campaignsXml(
  campaigns: PgrDocxCampaign[],
  labels: { actions: string },
  options: { shading?: string } = {},
): string {
  if (campaigns.length === 0) return paragraph("");
  const perRow = 4;
  const width = Math.floor(PGR_DOCX_CONTENT_WIDTH / perRow);
  const textLimit = width - CELL_TEXT_MARGIN;
  const widths = Array(perRow).fill(width);
  const rows: string[] = [];
  const BULLET = "• ";
  const bulletIndent = Math.ceil(textWidth(BULLET, PGR_DOCX_SIZES.tableSmall));
  for (let start = 0; start < campaigns.length; start += perRow) {
    const chunk = campaigns.slice(start, start + perRow);
    const pad = perRow - chunk.length;
    const lastChunk = start + perRow >= campaigns.length;
    const filler = Array.from({ length: pad }, () => cell("", { width }));
    rows.push(
      row([
        ...chunk.map((campaign) => {
          const colors = campaignColors(campaign.theme);
          const title =
            textWidth(campaign.theme, PGR_DOCX_SIZES.table, true) <= textLimit
              ? `**${campaign.theme}**`
              : balancedLines(campaign.theme, {
                  size: PGR_DOCX_SIZES.table,
                  width: textLimit,
                  bold: true,
                })
                  .map((line) => `**${line}**`)
                  .join("\n");
          return cell(
            cellParagraph(title, {
              color: options.shading ? PGR_DOCX_COLORS.text : colors.text,
              size: PGR_DOCX_SIZES.table,
              align: "center",
              shading: options.shading,
              keepNext: true,
            }),
            { width, fill: colors.fill },
          );
        }),
        ...filler,
      ]),
      row([
        ...chunk.map((campaign) => {
          const colors = campaignColors(campaign.theme);
          const actions = campaign.actions
            .split(";")
            .map((action) => action.trim().replace(/\.$/, ""))
            .filter(Boolean)
            .map((action) => `${action.charAt(0).toUpperCase()}${action.slice(1)}`);
          return cell(
            [
              cellParagraph(`**${labels.actions}**`, {
                size: PGR_DOCX_SIZES.tableSmall,
                color: PGR_DOCX_COLORS.muted,
                shading: options.shading,
                keepNext: !lastChunk,
              }),
              ...actions.map((action) => {
                const itemLines = balancedItemLines(action, textLimit - bulletIndent);
                return cellParagraph(`${BULLET}${itemLines.join("\n")}`, {
                  size: PGR_DOCX_SIZES.tableSmall,
                  shading: options.shading,
                  indent: bulletIndent,
                  hanging: bulletIndent,
                  keepNext: !lastChunk,
                });
              }),
            ].join(""),
            { width, fill: colors.soft, vAlign: "top" },
          );
        }),
        ...filler,
      ]),
    );
  }
  return table(rows, widths, PGR_DOCX_COLORS.white);
}

function balancedItemLines(text: string, width: number): string[] {
  const size = PGR_DOCX_SIZES.tableSmall;
  if (textWidth(text, size) <= width) return [text];
  const lines = balancedLines(text, { size, width });
  const words = text.split(" ").filter(Boolean);
  const last = lines[lines.length - 1];
  if (words.length < 3 || last.includes(" ")) return lines;
  return [
    ...balancedLines(words.slice(0, -2).join(" "), { size, width }),
    words.slice(-2).join(" "),
  ];
}
