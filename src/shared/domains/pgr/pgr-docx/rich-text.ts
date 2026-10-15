import type { RichBlock } from "./defaults";
import { PGR_DOCX_STYLE_IDS, paragraph, richRuns, type RunOptions } from "./ooxml";

const NESTED_ITEM_INDENT = 680;
const LIST_KEEP_LIMIT = 4;
const NBSP = "\u00A0";
const LAST_WORD_LIMIT = 20;

const endsWithColon = (text: string) => text.replace(/\*\*/g, "").trimEnd().endsWith(":");

export function keepLastWords(text: string): string {
  const numbered = text
    .replace(/ (n\.º|N\.º|nº|Nº|n°) (?=\S)/g, `${NBSP}$1${NBSP}`)
    .replace(/\bNR (?=\d)/g, `NR${NBSP}`);
  const match = numbered.match(/^([\s\S]*\S) (\S+)$/);
  if (!match || match[2].replace(/\*\*/g, "").length > LAST_WORD_LIMIT) return numbered;
  return `${match[1]}${NBSP}${match[2]}`;
}

function listKeepNext(blocks: RichBlock[]) {
  const keepNext = new Set<number>();
  let run: number[] = [];
  const endRun = () => {
    const kept =
      run.length <= LIST_KEEP_LIMIT ? run.slice(0, -1) : [run[0], run[run.length - 2]];
    kept.forEach((index) => keepNext.add(index));
    run = [];
  };
  blocks.forEach((block, index) => {
    if (block.kind === "item") {
      run.push(index);
    } else {
      endRun();
    }
  });
  endRun();
  return keepNext;
}

/**
 * Converte o texto semi-fixo (lista de blocos) em parágrafos OOXML com os estilos do
 * template — é o valor das tags cruas `{{@texts.*}}`. `shading` pinta o fundo dos
 * trechos (usado só no template anotado, para marcar o semi-fixo em laranja).
 */
export function richTextToOoxml(
  blocks: RichBlock[],
  options: Pick<RunOptions, "shading"> & { keepLastWithNext?: boolean } = {},
) {
  if (blocks.length === 0) return paragraph("");
  const { keepLastWithNext, ...runOptions } = options;
  const listKeep = listKeepNext(blocks);
  return blocks
    .map((block, index) => {
      const keepLast = keepLastWithNext === true && index === blocks.length - 1;
      switch (block.kind) {
        case "subtitle":
          return paragraph(richRuns(block.text, runOptions), {
            style: PGR_DOCX_STYLE_IDS.subtitle,
            keepNext: true,
          });
        case "item":
          // Incisos romanos (I., II.…) ficam um nível abaixo das alíneas.
          return paragraph(richRuns(keepLastWords(block.text), runOptions), {
            style: PGR_DOCX_STYLE_IDS.item,
            indent: /^[IVX]+\.\s/.test(block.text) ? NESTED_ITEM_INDENT : undefined,
            keepNext: listKeep.has(index) || keepLast,
          });
        default:
          return paragraph(richRuns(keepLastWords(block.text), runOptions), {
            style: PGR_DOCX_STYLE_IDS.body,
            keepNext: endsWithColon(block.text) || keepLast,
          });
      }
    })
    .join("");
}

/**
 * Texto livre (editado no site) → blocos: cada linha é um parágrafo; linha que começa
 * com marcador de lista (`a)`, `I.`, `-`, `1.`) vira item; linha prefixada com `## `
 * vira subtítulo.
 */
export function plainTextToBlocks(text: string): RichBlock[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): RichBlock => {
      if (line.startsWith("## ")) return { kind: "subtitle", text: line.slice(3) };
      if (/^([a-z]\)|[IVX]+\.|-|\d+\.)\s/.test(line)) return { kind: "item", text: line };
      return { kind: "paragraph", text: line };
    });
}
