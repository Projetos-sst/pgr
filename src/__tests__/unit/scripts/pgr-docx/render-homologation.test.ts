import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { PGR_DOCX_SAMPLE_CASE_IDS } from "@/shared/domains/pgr/pgr-docx/sample-cases";
import { PGR_DOCX_TEMPLATE_FILE } from "@/shared/domains/pgr/pgr-docx/template-file";
import { pgrDocxTextsSha256 } from "@/shared/domains/pgr/pgr-docx/texts-hash";

import { renderHomologationSamples } from "../../../../../scripts/pgr-docx/render-homologation";

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const template = readFileSync(path.join(process.cwd(), PGR_DOCX_TEMPLATE_FILE));

describe("amostras de homologação do modelo", () => {
  let directory = "";
  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "pgr-homologation-"));
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("grava um DOCX por caso e um manifesto com a versão do modelo e dos textos", async () => {
    const manifest = await renderHomologationSamples({ template, directory });
    expect(manifest.synthetic).toBe(true);
    expect(manifest.templateSha256).toBe(sha256(template));
    expect(manifest.textsSha256).toBe(pgrDocxTextsSha256({}));
    expect(manifest.problems).toEqual([]);
    expect(manifest.cases.map((item) => item.id)).toEqual([...PGR_DOCX_SAMPLE_CASE_IDS]);
    for (const item of manifest.cases) {
      const docx = readFileSync(path.join(directory, `${item.id}.docx`));
      expect(item.docxSha256).toBe(sha256(docx));
      expect(item.pdfSha256).toBeNull();
      expect(item.tables).toBeGreaterThan(5);
      expect(item.tablesWithRepeatedHeader).toBeGreaterThan(2);
    }
    expect(
      JSON.parse(readFileSync(path.join(directory, "manifest.json"), "utf8")),
    ).toEqual(manifest);
  });

  it("as amostras versionadas foram geradas com o modelo versionado", () => {
    const samples = path.join(process.cwd(), "templates/pgr/amostras");
    const versioned: Awaited<ReturnType<typeof renderHomologationSamples>> = JSON.parse(
      readFileSync(path.join(samples, "manifest.json"), "utf8"),
    );
    expect(versioned.templateSha256).toBe(sha256(template));
    expect(versioned.problems).toEqual([]);
    expect(versioned.cases.map((item) => item.id)).toEqual([...PGR_DOCX_SAMPLE_CASE_IDS]);
    for (const item of versioned.cases) {
      expect(sha256(readFileSync(path.join(samples, `${item.id}.docx`)))).toBe(
        item.docxSha256,
      );
      expect(sha256(readFileSync(path.join(samples, `${item.id}.pdf`)))).toBe(
        item.pdfSha256,
      );
    }
  });

  it("com conversor, grava o PDF de cada caso e o hash dele no manifesto", async () => {
    const convert = jest.fn(async (docx: Buffer) =>
      Buffer.from(`%PDF-1.7 ${docx.length}`),
    );
    const manifest = await renderHomologationSamples({ template, directory, convert });
    expect(convert).toHaveBeenCalledTimes(PGR_DOCX_SAMPLE_CASE_IDS.length);
    for (const item of manifest.cases) {
      const pdf = readFileSync(path.join(directory, `${item.id}.pdf`));
      expect(item.pdfSha256).toBe(sha256(pdf));
    }
  });

  it("resposta do conversor que não é PDF vira problema no manifesto", async () => {
    const manifest = await renderHomologationSamples({
      template,
      directory,
      convert: async () => Buffer.from("<html>erro</html>"),
    });
    expect(manifest.problems).toHaveLength(PGR_DOCX_SAMPLE_CASE_IDS.length);
    expect(manifest.problems[0]).toContain("empresa-pequena");
  });
});
