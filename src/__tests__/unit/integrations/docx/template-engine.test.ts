/**
 * @jest-environment node
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import PizZip from "pizzip";

import { buildPgrDocxData } from "@/shared/domains/pgr/pgr-docx/build-data";
import { PGR_DOCX_EXAMPLE_CONTENT } from "@/shared/domains/pgr/pgr-docx/example-content";
import { buildPgrDocxPreviewContent } from "@/shared/domains/pgr/pgr-docx/preview";
import {
  PGR_DOCX_LOGO_PLACEHOLDER,
  PGR_DOCX_TEMPLATE_FILE,
} from "@/shared/domains/pgr/pgr-docx/template-file";
import {
  dottedPathParser,
  extractDocxText,
  findLeftoverMarkers,
  listTemplateTags,
  renderDocxTemplate,
} from "@/shared/integrations/docx/template-engine";

const template = readFileSync(path.join(process.cwd(), PGR_DOCX_TEMPLATE_FILE));

/** PNG 2x1 mínimo (só o cabeçalho IHDR importa para o ajuste de caixa). */
function png(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(33);
  buffer.writeUInt32BE(0x89504e47, 0);
  buffer.writeUInt32BE(0x0d0a1a0a, 4);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

describe("dottedPathParser", () => {
  it("lê caminho pontuado só em chaves próprias", () => {
    const scope = { company: { razaoSocial: "X" }, list: [1] };
    expect(dottedPathParser("company.razaoSocial").get(scope)).toBe("X");
    expect(dottedPathParser(" company.razaoSocial ").get(scope)).toBe("X");
    expect(dottedPathParser("company.missing").get(scope)).toBeUndefined();
    expect(dottedPathParser("company.constructor").get(scope)).toBeUndefined();
    expect(dottedPathParser("__proto__").get(scope)).toBeUndefined();
    expect(dottedPathParser(".").get("valor")).toBe("valor");
  });
});

describe("findLeftoverMarkers", () => {
  it("lista marcadores sem repetir", () => {
    expect(findLeftoverMarkers("a {{x}} b {{x}} {{y.z}} {z}")).toEqual([
      "{{x}}",
      "{{y.z}}",
    ]);
  });
});

describe("template do PGR", () => {
  it("renderiza o exemplo sem marcadores sobrando nem tags sem valor", () => {
    const { buffer, missingTags } = renderDocxTemplate(
      template,
      buildPgrDocxData(PGR_DOCX_EXAMPLE_CONTENT),
    );
    const text = extractDocxText(buffer);
    expect(missingTags).toEqual([]);
    expect(findLeftoverMarkers(text)).toEqual([]);
    expect(text).toContain("CONSTRUTORA HORIZONTE EXEMPLO LTDA");
    expect(text).toContain("GES 02 - ESTRUTURA E ALVENARIA");
    expect(text).toContain("Exposição ao ruído de betoneira e serra circular");
  });

  it("toda tag de dado do template existe no objeto de dados", () => {
    const tags = listTemplateTags(template);
    expect(tags.length).toBeGreaterThan(100);
    // A prévia preenche cada campo dinâmico com a própria tag: nenhuma pode faltar.
    const { missingTags } = renderDocxTemplate(
      template,
      buildPgrDocxData(buildPgrDocxPreviewContent()),
    );
    expect(missingTags).toEqual([]);
  });

  it("repete GES, riscos e linhas de tabela pelos loops", () => {
    const { buffer } = renderDocxTemplate(
      template,
      buildPgrDocxData(PGR_DOCX_EXAMPLE_CONTENT),
    );
    const text = extractDocxText(buffer);
    for (const role of PGR_DOCX_EXAMPLE_CONTENT.jobRoles)
      expect(text).toContain(role.name);
    const riskCount = PGR_DOCX_EXAMPLE_CONTENT.ges.reduce(
      (n, ges) => n + ges.risks.length,
      0,
    );
    expect(text.match(/Fim do Risco/g)?.length).toBe(riskCount);
  });

  it("troca o logo placeholder dos cabeçalhos mantendo a proporção na caixa", () => {
    const logo = png(400, 100);
    const { buffer } = renderDocxTemplate(
      template,
      buildPgrDocxData(PGR_DOCX_EXAMPLE_CONTENT),
      {
        images: { [PGR_DOCX_LOGO_PLACEHOLDER]: logo },
      },
    );
    const zip = new PizZip(buffer);
    expect(zip.file(`word/media/${PGR_DOCX_LOGO_PLACEHOLDER}.png`)).not.toBeNull();
    const headers = Object.keys(zip.files).filter((name) =>
      /^word\/header\d*\.xml$/.test(name),
    );
    const extents = headers.flatMap((name) => {
      const xml = zip.file(name)!.asText();
      if (!xml.includes(`name="${PGR_DOCX_LOGO_PLACEHOLDER}"`)) return [];
      const [, cx, cy] = xml.match(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/)!;
      return [Number(cx) / Number(cy)];
    });
    expect(extents.length).toBeGreaterThan(0);
    for (const ratio of extents) expect(ratio).toBeCloseTo(4, 1);
  });
});
