import type { RichBlock } from "./defaults";
import { PGR_DOCX_STYLE_IDS, paragraph, richRuns, type RunOptions } from "./ooxml";

const NESTED_ITEM_INDENT = 680;

/**
 * Converte o texto semi-fixo (lista de blocos) em parágrafos OOXML com os estilos do
 * template — é o valor das tags cruas `{{@texts.*}}`. `shading` pinta o fundo dos
 * trechos (usado só no template anotado, para marcar o semi-fixo em laranja).
 */
export function richTextToOoxml(
  blocks: RichBlock[],
  options: Pick<RunOptions, "shading"> = {},
) {
  if (blocks.length === 0) return paragraph("");
  return blocks
    .map((block) => {
      switch (block.kind) {
        case "subtitle":
          return paragraph(richRuns(block.text, options), {
            style: PGR_DOCX_STYLE_IDS.subtitle,
            keepNext: true,
          });
        case "item":
          // Incisos romanos (I., II.…) ficam um nível abaixo das alíneas.
          return paragraph(richRuns(block.text, options), {
            style: PGR_DOCX_STYLE_IDS.item,
            indent: /^[IVX]+\.\s/.test(block.text) ? NESTED_ITEM_INDENT : undefined,
          });
        default:
          return paragraph(richRuns(block.text, options), {
            style: PGR_DOCX_STYLE_IDS.body,
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
