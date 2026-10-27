/** Synthetic review artifact only. Never reads a customer attachment or database. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { PGR_DOCX_EXAMPLE_CONTENT } from "@/shared/domains/pgr/pgr-docx/example-content";
import { buildPgrDocxData } from "@/shared/domains/pgr/pgr-docx/build-data";
import {
  PGR_DOCX_TEMPLATE_FILE,
  PGR_DOCX_LOGO_PLACEHOLDER,
} from "@/shared/domains/pgr/pgr-docx/template-file";
import {
  renderDocxTemplate,
  extractDocxText,
  findLeftoverMarkers,
} from "@/shared/integrations/docx/template-engine";
import { docxToPdf } from "@/shared/integrations/pdf/gotenberg";
import {
  markDemonstrationDocx,
  PGR_DEMONSTRATION_NOTICE,
} from "@/shared/domains/pgr/pgr-docx/demonstration";
async function main() {
  if (!process.env.GOTENBERG_URL)
    throw new Error("A preview requires the local test Gotenberg service.");
  const output = path.resolve("node_modules/.pgr-review-output");
  await mkdir(output, { recursive: true });
  const content = {
    ...PGR_DOCX_EXAMPLE_CONTENT,
    emissionNotice:
      "PRÉVIA SINTÉTICA PARA REVISÃO — não representa parecer, assinatura ou cliente real.",
    machines: [
      {
        name: "Máquina fictícia para teste de composição",
        manufacturer: "Fabricante fictício",
        identifier: "TESTE-001",
        quantity: "1",
        description: "Equipamento de exemplo vinculado ao ambiente sintético. ".repeat(8),
        operatingConditions: "Condições declaradas apenas para teste de apresentação.",
        safetyMeasures:
          "Descrição sintética; não representa recomendação ou certificação técnica.",
        maintenanceNotes:
          "Acompanhamento fictício para testar quebra de linha e paginação.",
        responsible: "Pessoa fictícia",
        context: "Ambiente de exemplo",
      },
    ],
  };
  const template = await readFile(PGR_DOCX_TEMPLATE_FILE);
  const data = buildPgrDocxData(content);
  const result = renderDocxTemplate(template, data, {
    images: { [PGR_DOCX_LOGO_PLACEHOLDER]: null },
  });
  if (
    findLeftoverMarkers(extractDocxText(result.buffer)).length ||
    result.missingTags.length
  )
    throw new Error("Unmapped fields in review preview.");
  const pdf = await docxToPdf(result.buffer, "pgr-review-preview.docx");
  if (pdf.subarray(0, 4).toString() !== "%PDF") throw new Error("Invalid PDF response.");
  await writeFile(path.join(output, "pgr-review-preview.docx"), result.buffer);
  await writeFile(path.join(output, "pgr-review-preview.pdf"), pdf);
  const demonstration = markDemonstrationDocx(result.buffer);
  if (!extractDocxText(demonstration).includes(PGR_DEMONSTRATION_NOTICE))
    throw new Error("Trial demonstration is missing its mark.");
  const demonstrationPdf = await docxToPdf(demonstration, "pgr-trial-demonstration.docx");
  if (demonstrationPdf.subarray(0, 4).toString() !== "%PDF")
    throw new Error("Invalid demonstration PDF response.");
  await writeFile(path.join(output, "pgr-trial-demonstration.docx"), demonstration);
  await writeFile(path.join(output, "pgr-trial-demonstration.pdf"), demonstrationPdf);
  const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
  await writeFile(
    path.join(output, "manifest.json"),
    JSON.stringify(
      {
        synthetic: true,
        templateSha256: hash(template),
        docxSha256: hash(result.buffer),
        pdfSha256: hash(pdf),
        demonstrationDocxSha256: hash(demonstration),
        demonstrationPdfSha256: hash(demonstrationPdf),
      },
      null,
      2,
    ),
  );
  console.log("Synthetic DOCX and real converted PDF ready for visual review.");
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Preview failed");
  process.exitCode = 1;
});
