/**
 * Gera o template e renderiza as amostras do PGR em DOCX + PDF:
 *
 *   docker compose up -d gotenberg   # monta templates/pgr/fonts (Manrope)
 *   GOTENBERG_URL=http://localhost:3001 npm run pgr-docx:samples
 *
 * - `templates/pgr/pgr-template-limpo.{docx,pdf}` — o template como documento: textos
 *   fixos, semi-fixos já com o default e dinâmicos como `{{tag}}`, sem marcação de cor;
 * - `templates/pgr/pgr-template-anotado.{docx,pdf}` — o mesmo, com a marcação do PGR
 *   2026.1: fixo em amarelo, semi-fixo (default editável) em laranja;
 * - `templates/pgr/exemplo/pgr-exemplo.{docx,pdf}` — template preenchido com dados fictícios;
 * - `docs/_local-refs/pgr-2026/` — réplica do PGR 2026 real, SÓ se o JSON de conteúdo
 *   (dados de cliente, gitignored) existir localmente.
 *
 * Sem `GOTENBERG_URL` só os `.docx` são gerados.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildPgrDocxData,
  type PgrDocxTemplateData,
} from "@/shared/domains/pgr/pgr-docx/build-data";
import type { PgrDocxContent } from "@/shared/domains/pgr/pgr-docx/content";
import { PGR_DOCX_EXAMPLE_CONTENT } from "@/shared/domains/pgr/pgr-docx/example-content";
import {
  buildPgrDocxPreviewContent,
  previewDerivedTags,
} from "@/shared/domains/pgr/pgr-docx/preview";
import { docxToPdf } from "@/shared/integrations/pdf/gotenberg";
import {
  extractDocxText,
  findLeftoverMarkers,
  renderDocxTemplate,
} from "@/shared/integrations/docx/template-engine";

import { buildTemplates, TEMPLATE_DIR } from "./build-template";
import { renderHomologationSamples } from "./render-homologation";
import { LOGO_PLACEHOLDER_NAME } from "./template-document";

const LOCAL_REFS = path.join(process.cwd(), "docs/_local-refs/pgr-2026");

async function emit(
  template: Buffer,
  data: PgrDocxTemplateData,
  output: string,
  options: { logo?: Buffer; expectNoMarkers?: boolean } = {},
) {
  mkdirSync(path.dirname(output), { recursive: true });
  const { buffer, missingTags } = renderDocxTemplate(template, data, {
    images: { [LOGO_PLACEHOLDER_NAME]: options.logo },
  });
  writeFileSync(`${output}.docx`, buffer);
  const leftovers = findLeftoverMarkers(extractDocxText(buffer));
  if (options.expectNoMarkers && leftovers.length > 0) {
    throw new Error(`${output}: marcadores sobrando: ${leftovers.join(", ")}`);
  }
  if (missingTags.length > 0) console.warn(`  ! sem valor: ${missingTags.join(", ")}`);
  const label = path.relative(process.cwd(), output);
  if (process.env.GOTENBERG_URL) {
    writeFileSync(
      `${output}.pdf`,
      await docxToPdf(buffer, `${path.basename(output)}.docx`),
    );
    console.log(`  ${label}.docx + .pdf`);
  } else {
    console.log(`  ${label}.docx (sem GOTENBERG_URL: PDF não gerado)`);
  }
}

async function main() {
  const files = await buildTemplates();
  const template = readFileSync(files.template);
  console.log("PGR DOCX — amostras");

  await emit(
    template,
    previewDerivedTags(buildPgrDocxData(buildPgrDocxPreviewContent())),
    path.join(TEMPLATE_DIR, "pgr-template-limpo"),
  );

  await emit(
    readFileSync(files.annotated),
    previewDerivedTags(
      buildPgrDocxData(buildPgrDocxPreviewContent(), { annotate: true }),
    ),
    path.join(TEMPLATE_DIR, "pgr-template-anotado"),
  );

  await emit(
    template,
    buildPgrDocxData(PGR_DOCX_EXAMPLE_CONTENT),
    path.join(TEMPLATE_DIR, "exemplo/pgr-exemplo"),
    { expectNoMarkers: true },
  );

  const manifest = await renderHomologationSamples({
    template,
    directory: path.join(TEMPLATE_DIR, "amostras"),
    convert: process.env.GOTENBERG_URL ? docxToPdf : undefined,
  });
  console.log(`  templates/pgr/amostras: ${manifest.cases.length} casos + manifest.json`);
  if (manifest.problems.length > 0) {
    console.error(manifest.problems.join("\n"));
    process.exitCode = 1;
  }

  const realContent = path.join(LOCAL_REFS, "pgr-2026.content.json");
  if (existsSync(realContent)) {
    const content = JSON.parse(readFileSync(realContent, "utf8")) as PgrDocxContent;
    const logoPath = path.join(LOCAL_REFS, "logo.png");
    await emit(
      template,
      buildPgrDocxData(content),
      path.join(LOCAL_REFS, "PGR 2026 - PGR-e"),
      {
        logo: existsSync(logoPath) ? readFileSync(logoPath) : undefined,
        expectNoMarkers: true,
      },
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
