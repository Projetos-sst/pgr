import {
  AlignmentType,
  BorderStyle,
  LineRuleType,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  VerticalMergeType,
  WidthType,
  type IBorderOptions,
  type IRunOptions,
  type ParagraphChild,
} from "docx";

import { PGR_DOCX_ANNOTATION } from "@/shared/domains/pgr/pgr-docx/build-data";
import type {
  PgrDocxLabelKey,
  PgrDocxTitleKey,
} from "@/shared/domains/pgr/pgr-docx/defaults";
import {
  PGR_DOCX_CONTENT_WIDTH,
  PGR_DOCX_STYLE_IDS,
} from "@/shared/domains/pgr/pgr-docx/ooxml";
import {
  PGR_DOCX_COLORS,
  PGR_DOCX_SIZES,
  PGR_DOCX_TABLE_HEAD,
} from "@/shared/domains/pgr/pgr-docx/theme";

/**
 * Peças do gerador do template. Cada trecho de texto nasce com a sua CATEGORIA, como no
 * PGR 2026.1 marcado à mão:
 *
 * - `fx`    — FIXO (amarelo): texto literal do template, nunca muda;
 * - `label` — SEMI-FIXO (laranja): tag `{{labels.*}}`, default em `defaults.ts`, editável por PGR;
 * - `dy`    — DINÂMICO (sem marcação): tag com dado do banco;
 * - `ctl`   — tag de controle (loop/condição), some na renderização.
 *
 * No modo `annotated` os fixos e semi-fixos ganham o fundo da cor da categoria — é
 * esse arquivo que, renderizado com os defaults, vira o "template anotado".
 */

export type TemplateMode = "template" | "annotated";

export const WIDTH = PGR_DOCX_CONTENT_WIDTH;
export const C = PGR_DOCX_COLORS;
export const S = PGR_DOCX_SIZES;

type RunOptions = Omit<IRunOptions, "text" | "children">;

const shading = (fill: string | undefined) =>
  fill ? { type: ShadingType.CLEAR, color: "auto", fill } : undefined;

export function createKit(mode: TemplateMode) {
  const annotate = mode === "annotated";
  const fixedFill = annotate ? PGR_DOCX_ANNOTATION.fixed : undefined;
  const semiFill = annotate ? PGR_DOCX_ANNOTATION.semiFixed : undefined;

  // Sob a marcação clara, texto branco (cabeçalho de tabela) ficaria ilegível.
  const readable = (options: RunOptions) =>
    annotate && options.color === C.white ? { ...options, color: C.text } : options;
  const fx = (text: string, options: RunOptions = {}) =>
    new TextRun({ text, ...readable(options), shading: shading(fixedFill) });
  const semi = (tag: string, options: RunOptions = {}) =>
    new TextRun({ text: `{{${tag}}}`, ...readable(options), shading: shading(semiFill) });
  const label = (key: PgrDocxLabelKey, options: RunOptions = {}) =>
    semi(`labels.${key}`, options);
  const title = (key: PgrDocxTitleKey, options: RunOptions = {}) =>
    semi(`titles.${key}`, options);
  const dy = (tag: string, options: RunOptions = {}) =>
    new TextRun({ text: `{{${tag}}}`, ...options });
  const ctl = (tag: string) => new TextRun({ text: `{{${tag}}}` });
  /** Texto fixo com `**negrito**` inline. */
  const fxRich = (text: string, options: RunOptions = {}) =>
    text
      .split("**")
      .map((part, index) =>
        part ? fx(part, index % 2 === 1 ? { ...options, bold: true } : options) : null,
      )
      .filter((run): run is TextRun => run !== null);

  return { annotate, fx, fxRich, semi, label, title, dy, ctl };
}

export type Kit = ReturnType<typeof createKit>;

// ---------------------------------------------------------------- parágrafos

export function body(
  children: ParagraphChild[],
  options: { align?: "left" | "right" | "center"; keepNext?: boolean } = {},
) {
  return new Paragraph({
    style: PGR_DOCX_STYLE_IDS.body,
    keepNext: options.keepNext,
    alignment:
      options.align === "right"
        ? AlignmentType.RIGHT
        : options.align === "center"
          ? AlignmentType.CENTER
          : options.align === "left"
            ? AlignmentType.LEFT
            : undefined,
    children,
  });
}

export function subtitle(children: ParagraphChild[]) {
  return new Paragraph({ style: PGR_DOCX_STYLE_IDS.subtitle, children });
}

/** Parágrafo só com tag de controle (abre/fecha loop de bloco — some na renderização). */
export function control(kit: Kit, tag: string) {
  return new Paragraph({ children: [kit.ctl(tag)] });
}

/** Barra de título de seção: fundo indigo suave + filete indigo embaixo. */
export function heading(
  children: ParagraphChild[],
  options: { pageBreakBefore?: boolean; fill?: string } = {},
) {
  return new Paragraph({
    style: "PgrHeading1",
    pageBreakBefore: options.pageBreakBefore,
    keepNext: true,
    keepLines: true,
    shading: shading(options.fill ?? C.primarySoft),
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 12,
        color: options.fill ? C.primaryStrong : C.primary,
        space: 4,
      },
      ...(options.fill
        ? {
            left: { style: BorderStyle.SINGLE, size: 6, color: options.fill, space: 6 },
            right: { style: BorderStyle.SINGLE, size: 6, color: options.fill, space: 6 },
          }
        : {}),
    },
    children,
  });
}

/** Subtítulo de bloco do inventário ("1 - CARACTERIZAÇÃO DO PROCESSO"). */
export function subheading(children: ParagraphChild[]) {
  return new Paragraph({
    style: "PgrHeading2",
    keepNext: true,
    keepLines: true,
    shading: shading(C.surfaceAlt),
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: C.borderStrong, space: 3 },
    },
    children,
  });
}

export function spacer(after = 120) {
  return new Paragraph({
    spacing: { before: 0, after: 0, line: after, lineRule: LineRuleType.EXACT },
    children: [],
  });
}

// ---------------------------------------------------------------- tabelas

const line = (color: string, size = 4): IBorderOptions => ({
  style: BorderStyle.SINGLE,
  size,
  color,
});
const none: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NIL_BORDER = { style: BorderStyle.NIL, size: 0, color: "auto" } as const;

export const BORDERS = {
  grid: {
    top: line(C.border),
    bottom: line(C.border),
    left: line(C.border),
    right: line(C.border),
    insideHorizontal: line(C.border),
    insideVertical: line(C.border),
  },
  /** Cartão: contorno + linhas horizontais, sem divisória vertical. */
  card: {
    top: line(C.borderStrong),
    bottom: line(C.borderStrong),
    left: line(C.borderStrong),
    right: line(C.borderStrong),
    insideHorizontal: line(C.border),
    insideVertical: none,
  },
  rows: {
    top: none,
    bottom: line(C.border),
    left: none,
    right: none,
    insideHorizontal: line(C.border),
    insideVertical: none,
  },
  rowsOpen: {
    top: none,
    bottom: line(C.border),
    left: none,
    right: none,
    insideHorizontal: none,
    insideVertical: none,
  },
  none: {
    top: none,
    bottom: none,
    left: none,
    right: none,
    insideHorizontal: none,
    insideVertical: none,
  },
};

/** Parágrafo de célula (estilo de tabela, 7,5pt). */
export function tp(
  children: ParagraphChild[],
  options: {
    align?: "left" | "center" | "right";
    after?: number;
    /** Mantém a linha com a próxima (tabela/grupo não se parte entre páginas). */
    keepNext?: boolean;
  } = {},
) {
  return new Paragraph({
    style: PGR_DOCX_STYLE_IDS.tableText,
    keepNext: options.keepNext,
    alignment:
      options.align === "center"
        ? AlignmentType.CENTER
        : options.align === "right"
          ? AlignmentType.RIGHT
          : AlignmentType.LEFT,
    spacing: options.after !== undefined ? { after: options.after } : undefined,
    children,
  });
}

export type CellOptions = {
  width: number;
  fill?: string;
  span?: number;
  vMerge?: "restart" | "continue";
  vAlign?: "top" | "center" | "bottom";
  margins?: number;
  marginTop?: number;
  marginBottom?: number;
  openLeft?: boolean;
  openRight?: boolean;
  openTop?: boolean;
  openBottom?: boolean;
  bottomBorder?: boolean;
  bottomRule?: string;
  accentLeft?: string;
};

export function tc(children: (Paragraph | Table)[], options: CellOptions) {
  const margin = options.margins ?? 70;
  return new TableCell({
    width: { size: options.width, type: WidthType.DXA },
    columnSpan: options.span,
    verticalMerge:
      options.vMerge === "restart"
        ? VerticalMergeType.RESTART
        : options.vMerge === "continue"
          ? VerticalMergeType.CONTINUE
          : undefined,
    verticalAlign:
      options.vAlign === "top"
        ? VerticalAlign.TOP
        : options.vAlign === "bottom"
          ? VerticalAlign.BOTTOM
          : VerticalAlign.CENTER,
    shading: shading(options.fill),
    borders:
      options.openLeft ||
      options.openRight ||
      options.openTop ||
      options.openBottom ||
      options.bottomBorder ||
      options.bottomRule ||
      options.accentLeft
        ? {
            ...(options.openLeft ? { left: NIL_BORDER } : {}),
            ...(options.openRight ? { right: NIL_BORDER } : {}),
            ...(options.openTop ? { top: NIL_BORDER } : {}),
            ...(options.bottomBorder ? { bottom: line(C.border) } : {}),
            ...(options.openBottom ? { bottom: NIL_BORDER } : {}),
            ...(options.bottomRule ? { bottom: line(options.bottomRule, 12) } : {}),
            ...(options.accentLeft ? { left: line(options.accentLeft, 48) } : {}),
          }
        : undefined,
    margins: {
      top: options.marginTop ?? margin - 20,
      bottom: options.marginBottom ?? margin - 20,
      left: margin,
      right: margin,
    },
    children: children.length > 0 ? children : [new Paragraph({ children: [] })],
  });
}

export function tr(
  cells: TableCell[],
  options: { header?: boolean; cantSplit?: boolean } = {},
) {
  return new TableRow({
    tableHeader: options.header,
    cantSplit: options.cantSplit ?? true,
    children: cells,
  });
}

export function grid(
  rows: TableRow[],
  widths: number[],
  borders: (typeof BORDERS)[keyof typeof BORDERS] = BORDERS.grid,
) {
  return new Table({
    width: { size: widths.reduce((sum, w) => sum + w, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders,
    rows,
  });
}

export function headerRow(
  cells: { children: ParagraphChild[]; width: number; span?: number }[],
) {
  return tr(
    cells.map((cell) =>
      tc([tp(cell.children, { align: "left", keepNext: true })], {
        width: cell.width,
        span: cell.span,
        fill: PGR_DOCX_TABLE_HEAD.fill,
        bottomRule: PGR_DOCX_TABLE_HEAD.rule,
      }),
    ),
    { header: true },
  );
}

export const HEAD: RunOptions = {
  bold: true,
  color: PGR_DOCX_TABLE_HEAD.text,
  size: S.tableSmall,
};
export const MUTED: RunOptions = { color: C.muted };
export const SMALL_LABEL: RunOptions = { bold: true, size: S.label, color: C.muted };
