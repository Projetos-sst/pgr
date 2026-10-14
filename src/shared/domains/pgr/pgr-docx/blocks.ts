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
} from "./theme";

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
      color: PGR_DOCX_COLORS.white,
      size: PGR_DOCX_SIZES.tableSmall,
      align: "center",
    }),
    { width, fill: PGR_DOCX_COLORS.primary, ...extra },
  );

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
  const roleWidth = 2300;
  const markWidth = Math.floor(
    (PGR_DOCX_CONTENT_WIDTH - indexWidth - roleWidth) / matrix.columns.length,
  );
  const widths = [indexWidth, roleWidth, ...matrix.columns.map(() => markWidth)];
  const headerRow = row(
    [
      header(labels.index, indexWidth),
      header(labels.role, roleWidth),
      ...matrix.columns.map((column) => header(column, markWidth)),
    ],
    { header: true },
  );
  const bodyRows = matrix.rows.map((item, index) =>
    row([
      cell(
        cellParagraph(String(index + 1), {
          size: PGR_DOCX_SIZES.tableSmall,
          align: "center",
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
        }),
        {
          width: roleWidth,
          fill: index % 2 === 1 ? PGR_DOCX_COLORS.surfaceAlt : undefined,
        },
      ),
      ...matrix.columns.map((_, column) =>
        cell(
          cellParagraph(item.marks[column] ? "X" : "", {
            bold: true,
            color: PGR_DOCX_COLORS.primaryStrong,
            size: PGR_DOCX_SIZES.tableSmall,
            align: "center",
          }),
          {
            width: markWidth,
            fill: index % 2 === 1 ? PGR_DOCX_COLORS.surfaceAlt : undefined,
          },
        ),
      ),
    ]),
  );
  return table([headerRow, ...bodyRows], widths);
}

/**
 * Seção 17 — matriz 5×5 (linhas = probabilidade 5→1, colunas = severidade 1→5), cada
 * célula com `P×S` na cor da classe, seguida da legenda das classes.
 */
export function riskMatrixXml(
  methodology: PgrDocxMethodology["matrix"],
  labels: { probability: string; severity: string; legend: string },
): string {
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
      cell("", { width: leftWidth, gridSpan: 3, vMerge: "continue" }),
      ...methodology.severityLabels.map((label) =>
        cell(muted(label), { width: sevWidth, fill: PGR_DOCX_COLORS.surfaceAlt }),
      ),
    ]),
    row([
      cell("", { width: leftWidth, gridSpan: 3, vMerge: "continue" }),
      ...[1, 2, 3, 4, 5].map((level) =>
        cell(muted(String(level), true), {
          width: sevWidth,
          fill: PGR_DOCX_COLORS.surfaceAlt,
        }),
      ),
    ]),
  ];

  const body = PGR_DOCX_RISK_MATRIX.map((classes, index) => {
    const probability = 5 - index;
    return row([
      cell(index === 0 ? muted(labels.probability, true) : "", {
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
        cellParagraph(colors.range, {
          bold: true,
          size: PGR_DOCX_SIZES.tableSmall,
          align: "center",
          keepNext: !last,
        }),
        { width: titleWidth + probLabelWidth, gridSpan: 2 },
      ),
      cell("", { width: levelWidth + sevWidth * 2, gridSpan: 3, fill: colors.strong }),
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
  const widths = Array(perRow).fill(width);
  const rows: string[] = [];
  for (let start = 0; start < campaigns.length; start += perRow) {
    const chunk = campaigns.slice(start, start + perRow);
    const pad = perRow - chunk.length;
    const filler = Array.from({ length: pad }, () => cell("", { width }));
    rows.push(
      row([
        ...chunk.map((campaign) => {
          const colors = campaignColors(campaign.theme);
          return cell(
            cellParagraph(`**${campaign.theme}**`, {
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
            .map((action) => `• ${action.charAt(0).toUpperCase()}${action.slice(1)}`);
          return cell(
            [
              cellParagraph(`**${labels.actions}**`, {
                size: PGR_DOCX_SIZES.tableSmall,
                color: PGR_DOCX_COLORS.muted,
                shading: options.shading,
              }),
              ...actions.map((action) =>
                cellParagraph(action, {
                  size: PGR_DOCX_SIZES.tableSmall,
                  shading: options.shading,
                }),
              ),
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
