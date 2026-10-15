import { lineBreak, paragraph, run } from "./ooxml";
import { fitFontSize, splitInTwo, textWidth, type TextSegment } from "./text-fit";
import { PGR_DOCX_COLORS } from "./theme";

export const COVER_TEXT_WIDTH = 7400;

const SPACE_AFTER = 40;
const SPACE_AFTER_COMPANY = 240;
const SPACE_AFTER_VALIDITY = 480;

export type CoverInput = {
  validity: string;
  razaoSocial: string;
  nomeFantasia: string;
  cityState: string;
  workUnit: string;
  contractNumbers: string;
  labels: { validity: string; contract: string };
};

export type CoverOptions = {
  annotate?: boolean;
  labelShading?: string;
};

export type CoverXml = {
  validityXml: string;
  razaoSocialXml: string;
  nomeFantasiaXml: string;
  cityStateXml: string;
  workUnitXml: string;
  contractXml: string;
};

type Piece = TextSegment & { color: string; shading?: string };

type CoverLine = {
  label?: string;
  value: string;
  size: number;
  minSize: number;
  color: string;
  bold?: boolean;
  after: number;
};

type CoverParagraph = { xml: string; size: number };

const upper = (text: string) =>
  text.includes("{{") ? text : text.toLocaleUpperCase("pt-BR");

const comparable = (text: string) =>
  text.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");

function splitToWidth(pieces: Piece[], size: number): Piece[][] {
  if (textWidth(pieces, size) <= COVER_TEXT_WIDTH) return [pieces];
  const halves = splitInTwo(pieces, size);
  if (halves.length < 2) return [pieces];
  return halves.flatMap((half) => splitToWidth(half, size));
}

function fitLine(pieces: Piece[], size: number, minSize: number) {
  const fitted = fitFontSize(pieces, { size, minSize, width: COVER_TEXT_WIDTH });
  if (fitted !== null) return { size: fitted, lines: [pieces] };
  return { size: minSize, lines: splitToWidth(pieces, minSize) };
}

function pieceRuns(pieces: Piece[], size: number): string {
  return pieces
    .map((piece) =>
      run(piece.text, {
        bold: piece.bold,
        color: piece.color,
        size,
        shading: piece.shading,
      }),
    )
    .join("");
}

function coverParagraph(line: CoverLine, shading: string | undefined): CoverParagraph {
  if (line.value === "") return { xml: "", size: 0 };
  const pieces: Piece[] = [];
  if (line.label) {
    pieces.push({
      text: line.label,
      bold: true,
      color: PGR_DOCX_COLORS.primaryStrong,
      shading,
    });
    pieces.push({ text: " ", color: line.color });
  }
  pieces.push({ text: line.value, bold: line.bold, color: line.color });
  const { size, lines } = fitLine(pieces, line.size, line.minSize);
  const runs = lines.map((parts) => pieceRuns(parts, size)).join(lineBreak({ size }));
  const xml = paragraph(runs, { align: "right", before: 0, after: line.after });
  return { xml, size };
}

export function buildCoverXml(input: CoverInput, options: CoverOptions = {}): CoverXml {
  const shading = options.annotate ? options.labelShading : undefined;
  const line = (spec: CoverLine) => coverParagraph(spec, shading);
  const razaoSocial = input.razaoSocial.trim();
  const nomeFantasia = input.nomeFantasia.trim();
  const showNomeFantasia =
    nomeFantasia !== "" && comparable(nomeFantasia) !== comparable(razaoSocial);
  const company = [
    upper(razaoSocial),
    showNomeFantasia ? upper(nomeFantasia) : "",
    upper(input.cityState.trim()),
  ];
  const lastCompany = company.reduce((last, value, index) => (value ? index : last), -1);
  const companyAfter = (index: number) =>
    index === lastCompany ? SPACE_AFTER_COMPANY : SPACE_AFTER;
  const razao = line({
    value: company[0],
    size: 24,
    minSize: 15,
    color: PGR_DOCX_COLORS.text,
    bold: true,
    after: companyAfter(0),
  });
  const companySize = razao.size || 19;
  const secondarySize = Math.min(19, companySize);
  const secondaryMinSize = Math.min(14, secondarySize);

  return {
    validityXml: line({
      label: input.labels.validity,
      value: input.validity.trim(),
      size: 26,
      minSize: 18,
      color: PGR_DOCX_COLORS.text,
      after: SPACE_AFTER_VALIDITY,
    }).xml,
    razaoSocialXml: razao.xml,
    nomeFantasiaXml: line({
      value: company[1],
      size: secondarySize,
      minSize: secondaryMinSize,
      color: PGR_DOCX_COLORS.muted,
      after: companyAfter(1),
    }).xml,
    cityStateXml: line({
      value: company[2],
      size: secondarySize,
      minSize: secondaryMinSize,
      color: PGR_DOCX_COLORS.muted,
      after: companyAfter(2),
    }).xml,
    workUnitXml: line({
      value: upper(input.workUnit.trim()),
      size: secondarySize,
      minSize: secondaryMinSize,
      color: PGR_DOCX_COLORS.muted,
      after: SPACE_AFTER,
    }).xml,
    contractXml: line({
      label: input.labels.contract,
      value: upper(input.contractNumbers.trim()),
      size: secondarySize,
      minSize: secondaryMinSize,
      color: PGR_DOCX_COLORS.muted,
      after: SPACE_AFTER,
    }).xml,
  };
}
