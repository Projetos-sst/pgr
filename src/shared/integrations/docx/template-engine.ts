import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

import { replaceImageByName } from "./image";

/**
 * Motor de preenchimento de templates DOCX — o equivalente local do fluxo do Salesbud
 * (template `.docx` com `{{marcadores}}` → documento final), com a mesma sintaxe de
 * delimitadores. Diferença: o Salesbud troca texto no Google Docs (`replaceAllText`),
 * o que não repete linhas de tabela; aqui o docxtemplater resolve loops/condições
 * (`{{#ges}}…{{/ges}}`), linhas de tabela e blocos OOXML (`{{@...}}`) no próprio DOCX,
 * e o Google/Gotenberg só converte o resultado. Sem `server-only`: também roda nos
 * scripts tsx de geração dos exemplos.
 */

export const DOCX_DELIMITERS = { start: "{{", end: "}}" } as const;

type Scope =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null
  | undefined;

/**
 * Parser de caminho pontuado (`company.razaoSocial`) — o parser padrão do docxtemplater
 * só lê chaves simples. `undefined` faz o docxtemplater subir para o escopo pai (tags
 * do GES visíveis dentro do loop de riscos). Só chaves próprias: nada de protótipo.
 */
export function dottedPathParser(tag: string) {
  const path = tag.trim();
  return {
    get(scope: Scope) {
      if (path === ".") return scope;
      let value: unknown = scope;
      for (const key of path.split(".")) {
        if (value === null || typeof value !== "object") return undefined;
        if (!Object.prototype.hasOwnProperty.call(value, key)) return undefined;
        value = (value as Record<string, unknown>)[key];
      }
      return value;
    },
  };
}

export type RenderDocxOptions = {
  /** Imagens a trocar por `docPr name` (ex.: logo da empresa no cabeçalho). */
  images?: Record<string, Buffer | null | undefined>;
};

export type RenderDocxResult = {
  buffer: Buffer;
  /** Tags sem valor no dado (renderizadas vazias) — o equivalente aos "marcadores faltantes". */
  missingTags: string[];
};

export function renderDocxTemplate(
  template: Buffer,
  data: object,
  options: RenderDocxOptions = {},
): RenderDocxResult {
  const zip = new PizZip(template);
  const missing = new Set<string>();
  const doc = new Docxtemplater(zip, {
    delimiters: DOCX_DELIMITERS,
    paragraphLoop: true,
    linebreaks: true,
    parser: dottedPathParser,
    nullGetter(part) {
      // Seção/loop sem valor (flag falsa, lista ausente) é condição, não falta de dado.
      if (part.module !== "loop" && part.value) missing.add(part.value);
      return "";
    },
  });
  doc.render(data);

  const rendered = doc.getZip();
  for (const [name, image] of Object.entries(options.images ?? {})) {
    if (image) replaceImageByName(rendered, name, image);
  }
  const buffer = rendered.generate({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer, missingTags: [...missing].sort() };
}

/**
 * Todas as tags do template, na ordem em que aparecem (`#ges`, `/ges`, `@texts.cipa`,
 * `company.razaoSocial`…). Lido do texto concatenado de cada parágrafo, então pega
 * tags quebradas em vários runs — o mesmo que o docxtemplater enxerga.
 */
export function listTemplateTags(template: Buffer): string[] {
  const text = extractDocxText(template);
  return [
    ...new Set([...text.matchAll(/\{\{([^{}]+)\}\}/g)].map((match) => match[1].trim())),
  ];
}

/** Texto visível de um DOCX (corpo + cabeçalhos + rodapés), para checagens. */
export function extractDocxText(docx: Buffer): string {
  const zip = new PizZip(docx);
  return Object.keys(zip.files)
    .filter((name) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(name))
    .map((name) =>
      (zip.file(name)?.asText() ?? "")
        .replace(/<w:tab\/>/g, "\t")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&"),
    )
    .join("\n");
}

/** Marcadores `{{...}}` que sobraram no texto (deveria ser zero num documento final). */
export function findLeftoverMarkers(text: string): string[] {
  return [...new Set(text.match(/\{\{[^{}]*\}\}/g) ?? [])];
}
