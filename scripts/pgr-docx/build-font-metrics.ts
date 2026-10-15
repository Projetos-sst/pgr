import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const FONTS_DIR = path.join(process.cwd(), "templates/pgr/fonts");
const OUTPUT = path.join(
  process.cwd(),
  "src/shared/domains/pgr/pgr-docx/font-metrics.ts",
);

const FIRST_CODE_POINT = 32;
const LAST_CODE_POINT = 383;
const EXTRA_CODE_POINTS = [
  0x2011, 0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x20ac, 0x2122,
  0x2192, 0x2264, 0x2265,
];

type FontTables = Record<string, { offset: number; length: number }>;

function readTables(font: Buffer): FontTables {
  const count = font.readUInt16BE(4);
  const tables: FontTables = {};
  for (let index = 0; index < count; index += 1) {
    const entry = 12 + index * 16;
    const tag = font.toString("latin1", entry, entry + 4);
    tables[tag] = {
      offset: font.readUInt32BE(entry + 8),
      length: font.readUInt32BE(entry + 12),
    };
  }
  return tables;
}

function glyphLookup(font: Buffer, cmapOffset: number): (codePoint: number) => number {
  const subtables = font.readUInt16BE(cmapOffset + 2);
  let format4: number | undefined;
  let format12: number | undefined;
  for (let index = 0; index < subtables; index += 1) {
    const entry = cmapOffset + 4 + index * 8;
    const platform = font.readUInt16BE(entry);
    const encoding = font.readUInt16BE(entry + 2);
    const offset = cmapOffset + font.readUInt32BE(entry + 4);
    const format = font.readUInt16BE(offset);
    if (platform === 3 && encoding === 10 && format === 12) format12 = offset;
    if (platform === 3 && encoding === 1 && format === 4) format4 = offset;
  }
  if (format12 !== undefined) {
    const table = format12;
    const groups = font.readUInt32BE(table + 12);
    return (codePoint) => {
      for (let index = 0; index < groups; index += 1) {
        const group = table + 16 + index * 12;
        const start = font.readUInt32BE(group);
        const end = font.readUInt32BE(group + 4);
        if (codePoint >= start && codePoint <= end) {
          return font.readUInt32BE(group + 8) + (codePoint - start);
        }
      }
      return 0;
    };
  }
  if (format4 === undefined) throw new Error("cmap sem subtabela Unicode (formato 4/12)");
  const table = format4;
  const segments = font.readUInt16BE(table + 6) / 2;
  const endCodes = table + 14;
  const startCodes = endCodes + segments * 2 + 2;
  const deltas = startCodes + segments * 2;
  const rangeOffsets = deltas + segments * 2;
  return (codePoint) => {
    for (let index = 0; index < segments; index += 1) {
      const end = font.readUInt16BE(endCodes + index * 2);
      if (codePoint > end) continue;
      const start = font.readUInt16BE(startCodes + index * 2);
      if (codePoint < start) return 0;
      const delta = font.readInt16BE(deltas + index * 2);
      const rangeOffset = font.readUInt16BE(rangeOffsets + index * 2);
      if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
      const glyphAddress =
        rangeOffsets + index * 2 + rangeOffset + (codePoint - start) * 2;
      const glyph = font.readUInt16BE(glyphAddress);
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };
}

function fontAdvances(file: string) {
  const font = readFileSync(path.join(FONTS_DIR, file));
  const tables = readTables(font);
  const unitsPerEm = font.readUInt16BE(tables.head.offset + 18);
  const hMetrics = font.readUInt16BE(tables.hhea.offset + 34);
  const glyphOf = glyphLookup(font, tables.cmap.offset);
  const advanceOf = (glyph: number) =>
    font.readUInt16BE(tables.hmtx.offset + Math.min(glyph, hMetrics - 1) * 4);
  const advance = (codePoint: number) => {
    const glyph = glyphOf(codePoint);
    return glyph === 0 ? null : advanceOf(glyph);
  };
  const base: number[] = [];
  for (let codePoint = FIRST_CODE_POINT; codePoint <= LAST_CODE_POINT; codePoint += 1) {
    base.push(advance(codePoint) ?? 0);
  }
  const extra: [number, number][] = EXTRA_CODE_POINTS.flatMap((codePoint) => {
    const width = advance(codePoint);
    return width === null ? [] : [[codePoint, width] as [number, number]];
  });
  const letters = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map(
    (letter) => advance(letter.charCodeAt(0)) ?? 0,
  );
  const fallback = Math.max(...letters);
  return { unitsPerEm, base, extra, fallback };
}

function main() {
  const regular = fontAdvances("Manrope-Regular.ttf");
  const bold = fontAdvances("Manrope-Bold.ttf");
  if (regular.unitsPerEm !== bold.unitsPerEm) {
    throw new Error("Regular e Bold com unitsPerEm diferentes");
  }
  const weight = (metrics: ReturnType<typeof fontAdvances>) =>
    [
      "{",
      `fallback: ${metrics.fallback},`,
      `base: [${metrics.base.join(", ")}],`,
      `extra: [${metrics.extra.map(([cp, w]) => `[${cp}, ${w}]`).join(", ")}],`,
      "}",
    ].join("\n");
  const source = [
    `export const MANROPE_UNITS_PER_EM = ${regular.unitsPerEm};`,
    "",
    `export const MANROPE_FIRST_CODE_POINT = ${FIRST_CODE_POINT};`,
    "",
    "export type ManropeAdvances = {",
    "  fallback: number;",
    "  base: readonly number[];",
    "  extra: readonly (readonly [number, number])[];",
    "};",
    "",
    'export const MANROPE_ADVANCES: Record<"regular" | "bold", ManropeAdvances> = {',
    `regular: ${weight(regular)},`,
    `bold: ${weight(bold)},`,
    "};",
    "",
  ].join("\n");
  writeFileSync(OUTPUT, source);
  console.log(`métricas: ${path.relative(process.cwd(), OUTPUT)}`);
}

main();
