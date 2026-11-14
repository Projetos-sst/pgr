import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildPgrDocxData } from "@/shared/domains/pgr/pgr-docx/build-data";
import {
  PGR_DOCX_SAMPLE_CASES,
  type PgrDocxSampleCase,
} from "@/shared/domains/pgr/pgr-docx/sample-cases";
import { PGR_DOCX_LOGO_PLACEHOLDER } from "@/shared/domains/pgr/pgr-docx/template-file";
import { pgrDocxTextsSha256 } from "@/shared/domains/pgr/pgr-docx/texts-hash";
import { inspectDocx } from "@/shared/integrations/docx/inspect";
import { renderDocxTemplate } from "@/shared/integrations/docx/template-engine";

export type HomologationOptions = {
  template: Buffer;
  directory: string;
  convert?: (docx: Buffer, fileName: string) => Promise<Buffer>;
};

type CaseResult = {
  id: string;
  title: string;
  checks: string;
  docxSha256: string;
  pdfSha256: string | null;
  tables: number;
  tablesWithRepeatedHeader: number;
  problems: string[];
};

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function renderCase(
  sample: PgrDocxSampleCase,
  options: HomologationOptions,
): Promise<CaseResult> {
  const { buffer, missingTags } = renderDocxTemplate(
    options.template,
    buildPgrDocxData(sample.content),
    { images: { [PGR_DOCX_LOGO_PLACEHOLDER]: null } },
  );
  const report = inspectDocx(buffer);
  writeFileSync(path.join(options.directory, `${sample.id}.docx`), buffer);
  const pdf = options.convert ? await options.convert(buffer, `${sample.id}.docx`) : null;
  const validPdf = pdf !== null && pdf.subarray(0, 4).toString() === "%PDF";
  if (pdf && validPdf)
    writeFileSync(path.join(options.directory, `${sample.id}.pdf`), pdf);
  const found = [
    ...missingTags.map((tag) => `campo sem valor: ${tag}`),
    ...report.leftoverMarkers.map((marker) => `marcador sobrando: ${marker}`),
    ...report.blankLiterals.map((literal) => `valor vazio impresso: ${literal}`),
    ...(pdf && !validPdf ? ["conversor não devolveu um PDF"] : []),
  ];
  return {
    id: sample.id,
    title: sample.title,
    checks: sample.checks,
    docxSha256: sha256(buffer),
    pdfSha256: pdf && validPdf ? sha256(pdf) : null,
    tables: report.tables.length,
    tablesWithRepeatedHeader: report.tables.filter(
      (table) => table.repeatedHeaderRows > 0,
    ).length,
    problems: found.map((problem) => `${sample.id}: ${problem}`),
  };
}

export async function renderHomologationSamples(options: HomologationOptions) {
  mkdirSync(options.directory, { recursive: true });
  const results: CaseResult[] = [];
  for (const sample of PGR_DOCX_SAMPLE_CASES) {
    results.push(await renderCase(sample, options));
  }
  const manifest = {
    synthetic: true,
    templateSha256: sha256(options.template),
    textsSha256: pgrDocxTextsSha256({}),
    cases: results.map(({ problems: _problems, ...item }) => item),
    problems: results.flatMap((item) => item.problems),
  };
  writeFileSync(
    path.join(options.directory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}
