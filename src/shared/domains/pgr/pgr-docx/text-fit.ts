import {
  MANROPE_ADVANCES,
  MANROPE_FIRST_CODE_POINT,
  MANROPE_UNITS_PER_EM,
  type ManropeAdvances,
} from "./font-metrics";

export type TextSegment = { text: string; bold?: boolean };

export const TEXT_FIT_SAFETY = 1.01;

const EXTRA = {
  regular: new Map(MANROPE_ADVANCES.regular.extra),
  bold: new Map(MANROPE_ADVANCES.bold.extra),
};

function advance(codePoint: number, bold: boolean): number {
  const metrics: ManropeAdvances = bold
    ? MANROPE_ADVANCES.bold
    : MANROPE_ADVANCES.regular;
  const fromBase = metrics.base[codePoint - MANROPE_FIRST_CODE_POINT];
  if (fromBase) return fromBase;
  return (bold ? EXTRA.bold : EXTRA.regular).get(codePoint) ?? metrics.fallback;
}

function units(text: string, bold: boolean): number {
  let total = 0;
  for (const char of text) total += advance(char.codePointAt(0) ?? 0, bold);
  return total;
}

export function textWidth(
  segments: TextSegment[] | string,
  size: number,
  bold = false,
): number {
  const list = typeof segments === "string" ? [{ text: segments, bold }] : segments;
  const total = list.reduce(
    (sum, segment) => sum + units(segment.text, !!segment.bold),
    0,
  );
  return (total / MANROPE_UNITS_PER_EM) * size * 10 * TEXT_FIT_SAFETY;
}

export function fitFontSize(
  segments: TextSegment[] | string,
  options: { size: number; minSize: number; width: number; bold?: boolean },
): number | null {
  for (let size = options.size; size >= options.minSize; size -= 1) {
    if (textWidth(segments, size, options.bold) <= options.width) return size;
  }
  return null;
}

function greedyLines(words: string[], measure: (line: string) => number, width: number) {
  const lines: string[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && measure(`${last} ${word}`) <= width) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines;
}

export function balancedLines(
  text: string,
  options: { size: number; width: number; bold?: boolean },
): string[] {
  const words = text.split(/ +/).filter(Boolean);
  if (words.length <= 1) return words.length === 1 ? words : [""];
  const measure = (line: string) => textWidth(line, options.size, options.bold);
  const count = greedyLines(words, measure, options.width).length;
  if (count <= 1) return [words.join(" ")];
  const n = words.length;
  const maxWidth = options.width;
  const limit = maxWidth + 1e-6;
  const wordWidths = words.map(measure);
  const space = measure(" ");
  const prefix = [0];
  for (const wordWidth of wordWidths) prefix.push(prefix[prefix.length - 1] + wordWidth);
  const lineWidth = (start: number, end: number) =>
    prefix[end] - prefix[start] + (end - start - 1) * space;
  const penalty = (count + 1) * maxWidth * maxWidth;
  const cost = (start: number, end: number) => {
    const width = lineWidth(start, end);
    if (width > limit && end - start > 1) return Infinity;
    let total = width > limit ? 0 : (maxWidth - width) ** 2;
    if (end === n && end - start === 1) total += penalty;
    if (start > 0 && /^[-–/]/.test(words[start])) total += penalty;
    return total;
  };
  const best = Array.from({ length: count + 1 }, () =>
    Array.from({ length: n + 1 }, () => Infinity),
  );
  const from = Array.from({ length: count + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );
  best[0][0] = 0;
  for (let lines = 1; lines <= count; lines += 1) {
    for (let end = lines; end <= n; end += 1) {
      for (let start = end - 1; start >= lines - 1; start -= 1) {
        if (lineWidth(start, end) > limit && end - start > 1) break;
        const total = best[lines - 1][start] + cost(start, end);
        if (total < best[lines][end]) {
          best[lines][end] = total;
          from[lines][end] = start;
        }
      }
    }
  }
  if (best[count][n] === Infinity) return greedyLines(words, measure, maxWidth);
  const result: string[] = [];
  let remaining = n;
  for (let lines = count; lines >= 1; lines -= 1) {
    const start = from[lines][remaining];
    result.unshift(words.slice(start, remaining).join(" "));
    remaining = start;
  }
  return result;
}

export function balancedText(
  text: string,
  options: { size: number; width: number; bold?: boolean },
): string {
  return text
    .split("\n")
    .map((paragraph) => balancedLines(paragraph, options).join("\n"))
    .join("\n");
}

function cutAt<T extends TextSegment>(segments: T[], index: number): [T[], T[]] {
  const left: T[] = [];
  const right: T[] = [];
  let offset = 0;
  for (const segment of segments) {
    const start = offset;
    offset += segment.text.length;
    if (offset <= index) left.push(segment);
    else if (start > index) right.push(segment);
    else {
      const local = index - start;
      if (local > 0) left.push({ ...segment, text: segment.text.slice(0, local) });
      if (local + 1 < segment.text.length) {
        right.push({ ...segment, text: segment.text.slice(local + 1) });
      }
    }
  }
  return [left, right];
}

export function splitInTwo<T extends TextSegment>(segments: T[], size: number): T[][] {
  const text = segments.map((segment) => segment.text).join("");
  let best: { parts: [T[], T[]]; width: number } | null = null;
  for (let index = 1; index < text.length - 1; index += 1) {
    if (text[index] !== " ") continue;
    const parts = cutAt(segments, index);
    const width = Math.max(textWidth(parts[0], size), textWidth(parts[1], size));
    if (!best || width < best.width) best = { parts, width };
  }
  return best ? best.parts : [segments];
}
