/**
 * Gera o template DOCX do PGR a partir do código (`template-document.ts`):
 *
 *   npm run pgr-docx:template
 *
 * - `templates/pgr/pgr-template.docx`          → template real, lido pela aplicação;
 * - `templates/pgr/build/pgr-template-annotated.docx` → mesmo template com o fundo de
 *   anotação (fixo amarelo / semi-fixo laranja), insumo do `render-samples.ts`.
 *
 * O `.docx` é artefato gerado: altere o template pelo código e rode o script de novo.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Packer } from "docx";

import { PGR_DOCX_TEMPLATE_FILE } from "@/shared/domains/pgr/pgr-docx/template-file";

import { embedFonts } from "./embed-fonts";
import { buildTemplateDocument } from "./template-document";

export const TEMPLATE_DIR = path.join(process.cwd(), "templates/pgr");
export const TEMPLATE_PATH = path.join(process.cwd(), PGR_DOCX_TEMPLATE_FILE);
export const ANNOTATED_SOURCE_PATH = path.join(
  TEMPLATE_DIR,
  "build/pgr-template-annotated.docx",
);

const FONTS_DIR = path.join(TEMPLATE_DIR, "fonts");

function templateFonts() {
  return [
    {
      name: "Manrope",
      regular: readFileSync(path.join(FONTS_DIR, "Manrope-Regular.ttf")),
      bold: readFileSync(path.join(FONTS_DIR, "Manrope-Bold.ttf")),
    },
  ];
}

export async function buildTemplates() {
  mkdirSync(path.dirname(ANNOTATED_SOURCE_PATH), { recursive: true });
  const fonts = templateFonts();
  writeFileSync(
    TEMPLATE_PATH,
    await embedFonts(await Packer.toBuffer(buildTemplateDocument("template")), fonts),
  );
  writeFileSync(
    ANNOTATED_SOURCE_PATH,
    await embedFonts(await Packer.toBuffer(buildTemplateDocument("annotated")), fonts),
  );
  return { template: TEMPLATE_PATH, annotated: ANNOTATED_SOURCE_PATH };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  buildTemplates()
    .then((files) => {
      console.log(`template:  ${path.relative(process.cwd(), files.template)}`);
      console.log(`anotado:   ${path.relative(process.cwd(), files.annotated)}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
