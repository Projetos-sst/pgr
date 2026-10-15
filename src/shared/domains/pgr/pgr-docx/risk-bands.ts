import { buildMatrix, type ClassificationBand } from "../methodology";

import {
  PGR_DOCX_RISK_CLASS_COLORS,
  PGR_DOCX_RISK_CLASSES,
  PGR_DOCX_RISK_MATRIX,
  type PgrDocxRiskClass,
} from "./theme";

export type PgrDocxRiskRanges = Record<PgrDocxRiskClass, string>;

const hasBands = (
  bands: ClassificationBand[] | undefined,
): bands is ClassificationBand[] => Array.isArray(bands) && bands.length > 0;

export function riskBandRanges(bands?: ClassificationBand[]): PgrDocxRiskRanges {
  if (!hasBands(bands)) {
    return Object.fromEntries(
      PGR_DOCX_RISK_CLASSES.map((riskClass) => [
        riskClass,
        PGR_DOCX_RISK_CLASS_COLORS[riskClass].range,
      ]),
    ) as PgrDocxRiskRanges;
  }
  const ranges = Object.fromEntries(
    PGR_DOCX_RISK_CLASSES.map((riskClass) => [riskClass, ""]),
  ) as PgrDocxRiskRanges;
  let min = 1;
  for (const band of bands) {
    ranges[band.classification] =
      min >= band.maxLevel ? String(band.maxLevel) : `${min}-${band.maxLevel}`;
    min = band.maxLevel + 1;
  }
  return ranges;
}

export function riskBandMatrix(
  bands?: ClassificationBand[],
): readonly (readonly PgrDocxRiskClass[])[] {
  if (!hasBands(bands)) return PGR_DOCX_RISK_MATRIX;
  const cells = buildMatrix(bands);
  return [5, 4, 3, 2, 1].map((probability) =>
    [1, 2, 3, 4, 5].map(
      (severity) =>
        cells.find(
          (cell) => cell.probability === probability && cell.severity === severity,
        )!.classification,
    ),
  );
}

export function riskMatrixClass(
  matrix: readonly (readonly PgrDocxRiskClass[])[],
  probability: number,
  severity: number,
): PgrDocxRiskClass {
  return matrix[5 - probability][severity - 1];
}

export function riskLevelLabels(
  bands?: ClassificationBand[],
): Record<PgrDocxRiskClass, string> {
  const ranges = riskBandRanges(bands);
  return Object.fromEntries(
    PGR_DOCX_RISK_CLASSES.map((riskClass) => [
      riskClass,
      ranges[riskClass]
        ? `${PGR_DOCX_RISK_CLASS_COLORS[riskClass].label} (${ranges[riskClass]})`
        : PGR_DOCX_RISK_CLASS_COLORS[riskClass].label,
    ]),
  ) as Record<PgrDocxRiskClass, string>;
}
