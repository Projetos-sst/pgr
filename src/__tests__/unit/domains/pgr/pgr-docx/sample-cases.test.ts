import { readFileSync } from "node:fs";
import path from "node:path";

import { buildPgrDocxData } from "@/shared/domains/pgr/pgr-docx/build-data";
import {
  LARGE_GES_COUNT,
  LARGE_JOB_ROLE_COUNT,
  LARGE_RISKS_PER_GES,
  PGR_DOCX_SAMPLE_CASE_IDS,
  PGR_DOCX_SAMPLE_CASES,
  SAMPLE_NOTICE,
  type PgrDocxSampleCaseId,
} from "@/shared/domains/pgr/pgr-docx/sample-cases";
import {
  PGR_DOCX_LOGO_PLACEHOLDER,
  PGR_DOCX_TEMPLATE_FILE,
} from "@/shared/domains/pgr/pgr-docx/template-file";
import { inspectDocx, type DocxReport } from "@/shared/integrations/docx/inspect";
import {
  extractDocxText,
  renderDocxTemplate,
} from "@/shared/integrations/docx/template-engine";

type Rendered = { text: string; report: DocxReport; missingTags: string[] };

const template = readFileSync(path.join(process.cwd(), PGR_DOCX_TEMPLATE_FILE));

function render(id: PgrDocxSampleCaseId): Rendered {
  const sample = PGR_DOCX_SAMPLE_CASES.find((item) => item.id === id);
  if (!sample) return { text: "", report: inspectDocx(template), missingTags: [id] };
  const { buffer, missingTags } = renderDocxTemplate(
    template,
    buildPgrDocxData(sample.content),
    { images: { [PGR_DOCX_LOGO_PLACEHOLDER]: null } },
  );
  return { text: extractDocxText(buffer), report: inspectDocx(buffer), missingTags };
}

const rendered = new Map(PGR_DOCX_SAMPLE_CASE_IDS.map((id) => [id, render(id)]));
const sampleOf = (id: PgrDocxSampleCaseId) => rendered.get(id) ?? render(id);
const count = (text: string, piece: string) => text.split(piece).length - 1;
const tableStarting = (report: DocxReport, firstRowText: string) =>
  report.tables.filter((table) => table.firstRowText.startsWith(firstRowText));

describe("amostras fictícias do PGR em DOCX", () => {
  it("há um caso para cada situação do aceite, todos marcados como fictícios", () => {
    expect(PGR_DOCX_SAMPLE_CASES.map((item) => item.id)).toEqual([
      ...PGR_DOCX_SAMPLE_CASE_IDS,
    ]);
    for (const item of PGR_DOCX_SAMPLE_CASES) {
      expect(item.content.emissionNotice).toBe(SAMPLE_NOTICE);
      expect(item.content.company.cnpj).toBe("00.000.000/0001-00");
    }
  });

  it.each(PGR_DOCX_SAMPLE_CASE_IDS)(
    "%s: nenhuma tag sobra, nenhum campo vira 'undefined' ou 'null' e as tabelas existem",
    (id) => {
      const { report, missingTags, text } = sampleOf(id);
      expect(missingTags).toEqual([]);
      expect(report.leftoverMarkers).toEqual([]);
      expect(report.blankLiterals).toEqual([]);
      expect(text).toContain(SAMPLE_NOTICE);
      expect(tableStarting(report, "RevisãoData")).toHaveLength(1);
      expect(tableStarting(report, "Função")).toHaveLength(1);
      expect(tableStarting(report, "GESRiscoAção")).toHaveLength(1);
    },
  );

  it("empresa pequena: um GES, um cartão de risco e o bloco de contrato ausente", () => {
    const { text, report } = sampleOf("empresa-pequena");
    expect(count(text, "1 - CARACTERIZAÇÃO DO PROCESSO")).toBe(2);
    expect(count(text, "Fim do Risco")).toBe(1);
    expect(text).not.toContain("Contratante:");
    expect(tableStarting(report, "RiscoControle de risco")).toHaveLength(1);
  });

  it("inventário extenso: todo GES e risco aparece e as tabelas longas repetem o cabeçalho", () => {
    const { text, report } = sampleOf("inventario-extenso");
    const risks = LARGE_GES_COUNT * LARGE_RISKS_PER_GES;
    expect(count(text, "1 - CARACTERIZAÇÃO DO PROCESSO")).toBe(LARGE_GES_COUNT + 1);
    expect(count(text, "Fim do Risco")).toBe(risks);
    const jobRoles = tableStarting(report, "Função")[0];
    expect(jobRoles.rows).toBeGreaterThan(LARGE_JOB_ROLE_COUNT);
    expect(jobRoles.repeatedHeaderRows).toBe(1);
    const annex = tableStarting(report, "GESRiscoAção")[0];
    expect(annex.rows).toBe(risks + 1);
    expect(annex.repeatedHeaderRows).toBe(1);
    const measures = tableStarting(report, "RiscoControle de risco");
    const epis = tableStarting(report, "Risco (Ref.)");
    expect(measures).toHaveLength(LARGE_GES_COUNT);
    expect(epis).toHaveLength(LARGE_GES_COUNT);
    for (const table of measures) {
      expect(table.rows).toBe(LARGE_RISKS_PER_GES * 4 + 1);
      expect(table.repeatedHeaderRows).toBe(1);
    }
    for (const table of epis) {
      expect(table.rows).toBe(LARGE_RISKS_PER_GES + 1);
      expect(table.repeatedHeaderRows).toBe(1);
    }
  });

  it("campos vazios: opcionais somem, obrigatórios mostram 'Não informado' e listas mostram o vazio", () => {
    const { text } = sampleOf("campos-vazios");
    expect(text).not.toContain("Inscrição Estadual");
    expect(text).not.toContain("Telefone:");
    expect(text).not.toContain("Contratante:");
    expect(text).toContain("Não informado");
    expect(text).toContain("Nenhuma função vinculada aos GES deste PGR.");
    expect(text).toContain("Nenhum risco identificado neste GES.");
    expect(text).toContain("Nenhuma medida de prevenção cadastrada neste GES.");
    expect(text).toContain("Nenhum EPI indicado para os riscos deste GES.");
    expect(text).toContain("Nenhuma ação planejada para os riscos deste GES.");
    expect(text).toContain("Nenhuma ação planejada neste PGR.");
    expect(text).toContain("Não avaliado");
  });

  it("com anexos: Anexo I, matriz de treinamento, campanhas e apêndice de máquinas preenchidos", () => {
    const { text } = sampleOf("com-anexos");
    expect(text).toContain("Anexo I");
    expect(text).toContain("Instalar linha de vida horizontal");
    expect(text).toContain("NR 35");
    expect(text).toContain("Janeiro Branco");
    expect(text).toContain("Betoneira fictícia 400 L");
    expect(text).toContain("AMOSTRA-002");
  });
});
