import type { ClassificationBand } from "@/shared/domains/pgr/methodology";
import {
  riskBandMatrix,
  riskBandRanges,
  riskLevelLabels,
  riskMatrixClass,
} from "@/shared/domains/pgr/pgr-docx/risk-bands";
import { PGR_DOCX_RISK_MATRIX } from "@/shared/domains/pgr/pgr-docx/theme";

const bands = (...limits: number[]): ClassificationBand[] =>
  (["trivial", "tolerable", "moderate", "substantial", "intolerable"] as const).map(
    (classification, index) => ({ classification, maxLevel: limits[index] }),
  );

describe("faixas de classificação no DOCX", () => {
  it("sem faixas usa as faixas e a matriz de referência", () => {
    expect(riskBandRanges()).toEqual({
      trivial: "1-3",
      tolerable: "3-8",
      moderate: "4-12",
      substantial: "10-15",
      intolerable: "15-25",
    });
    expect(riskBandRanges([])).toEqual(riskBandRanges());
    expect(riskBandMatrix()).toBe(PGR_DOCX_RISK_MATRIX);
    expect(riskMatrixClass(riskBandMatrix(), 2, 3)).toBe("moderate");
    expect(riskMatrixClass(riskBandMatrix(), 3, 2)).toBe("tolerable");
  });

  it("faixas contíguas a partir dos limites superiores", () => {
    expect(riskBandRanges(bands(2, 6, 12, 20, 25))).toEqual({
      trivial: "1-2",
      tolerable: "3-6",
      moderate: "7-12",
      substantial: "13-20",
      intolerable: "21-25",
    });
    expect(riskBandRanges(bands(1, 2, 10, 15, 25))).toMatchObject({
      trivial: "1",
      tolerable: "2",
      moderate: "3-10",
    });
  });

  it("matriz derivada das faixas é simétrica (classe pelo nível P×S)", () => {
    const matrix = riskBandMatrix(bands(2, 6, 12, 20, 25));
    expect(matrix[0]).toEqual([
      "tolerable",
      "moderate",
      "substantial",
      "substantial",
      "intolerable",
    ]);
    expect(riskMatrixClass(matrix, 2, 3)).toBe(riskMatrixClass(matrix, 3, 2));
    expect(riskMatrixClass(matrix, 1, 1)).toBe("trivial");
  });

  it("rótulos 'Classe (faixa)'", () => {
    expect(riskLevelLabels(bands(3, 8, 12, 16, 25))).toEqual({
      trivial: "Trivial (1-3)",
      tolerable: "Tolerável (4-8)",
      moderate: "Moderado (9-12)",
      substantial: "Substancial (13-16)",
      intolerable: "Intolerável (17-25)",
    });
  });
});
