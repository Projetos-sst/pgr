/**
 * Conteúdo do documento do PGR pelos **dois chamadores** (issue #47): a rota síncrona
 * (`generatePgrPdf`) e o worker de arquivamento (`processPdfBatchJob`). O template é
 * compartilhado, mas os dois caminhos montam o HTML por conta própria — este teste
 * prova que ambos veem os mesmos dados reais do Postgres efêmero.
 *
 * Gotenberg e Storage são mockados (o HTML é capturado antes de virar binário); a
 * leitura consolidada é a **de verdade**.
 */
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

const htmlToPdf = jest.fn();
const putGeneratedPdf = jest.fn();

jest.mock("@/shared/integrations/pdf/gotenberg", () => ({
  htmlToPdf: (...a: unknown[]) => htmlToPdf(...a),
}));
jest.mock("@/shared/integrations/storage/documents-storage", () => ({
  generatedPdfPath: (orgId: string, documentId: string) =>
    `${orgId}/documentos/generated/${documentId}.pdf`,
  putGeneratedPdf: (...a: unknown[]) => putGeneratedPdf(...a),
  slugifyFileName: (name: string) => name.toLowerCase().replace(/[^a-z0-9.]+/g, "-"),
}));

import type postgres from "postgres";

import { generatePgrPdf } from "@/shared/server/platform/pgr-pdf-core";
import { processPdfBatchJob } from "@/shared/server/platform/pdf-batch-core";
import type { Job } from "@/shared/db/schema/jobs";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const shouldRun =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;

const DOCUMENT_ID = "11111111-1111-1111-1111-1111111111b1";
const CAMPAIGN_ID = "11111111-1111-1111-1111-1111111111b2";
const EVALUATION_ID = "11111111-1111-1111-1111-1111111111b3";

const FAKE_PDF = Buffer.from("%PDF-1.4 fake");

function job(): Job {
  return {
    id: "job-pdf-1",
    orgId: "org_a",
    jobType: "pdf_batch",
    status: "processing",
    payload: { documentId: DOCUMENT_ID, kind: "pgr", pgrId: PGR_IDS.pgrA },
    result: null,
    attempts: 1,
    lockedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Job;
}

/** Recorta uma seção do documento pelo título numerado. */
function sectionOf(html: string, title: string): string {
  const start = html.indexOf(title);
  if (start === -1) return "";
  const end = html.indexOf("</section>", start);
  return html.slice(start, end === -1 ? undefined : end);
}

/** HTML que o chamador passou ao Gotenberg na última invocação. */
function lastHtml(): string {
  const calls = htmlToPdf.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return String(calls[calls.length - 1][0]);
}

(shouldRun ? describe : describe.skip)("PDF do PGR — rota e worker (#47)", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });

  afterAll(async () => {
    await admin.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await seedPgrBase(admin);
    htmlToPdf.mockReset().mockResolvedValue(FAKE_PDF);
    putGeneratedPdf
      .mockReset()
      .mockResolvedValue({ storagePath: "org_a/x.pdf", sizeBytes: FAKE_PDF.byteLength });

    await admin.unsafe(`
      insert into public.documents
        (id, org_id, document_group_id, name, doc_type, version, status, storage_path, size_bytes)
      values
        ('${DOCUMENT_ID}','org_a','${DOCUMENT_ID}','PGR','PGR',1,'generating','org_a/x.pdf',0);

      insert into public.psychosocial_campaigns
        (id, org_id, company_id, work_unit_id, name, status, public_token, starts_at, ends_at)
      values
        ('${CAMPAIGN_ID}','org_a','${PGR_IDS.companyA}','${PGR_IDS.workUnitA}','Clima 2026','closed','tok-pdf-a','2026-01-01','2026-03-31');

      insert into public.psychosocial_responses (org_id, campaign_id) values
        ('org_a','${CAMPAIGN_ID}'), ('org_a','${CAMPAIGN_ID}'), ('org_a','${CAMPAIGN_ID}');

      insert into public.psychosocial_risks (org_id, campaign_id, factor, level) values
        ('org_a','${CAMPAIGN_ID}','Ritmo de trabalho',3);

      insert into public.ergonomic_evaluations
        (id, org_id, risk_id, assessed_at, responsible, method, notes,
         posture, posture_notes, movements, physical_load, psychosocial_campaign_id)
      values
        ('${EVALUATION_ID}','org_a','${PGR_IDS.riskA}','2026-06-01','Ergonomista Beltrana','COPSOQ',
         'Reavaliar em 6 meses','inadequate','Bancada abaixo do cotovelo','adequate','not_applicable','${CAMPAIGN_ID}');
    `);
  });

  it("rota síncrona monta o PDF com a seção NR-17 na ordem correta", async () => {
    const { pdf, fileName } = await generatePgrPdf("org_a", PGR_IDS.pgrA);
    expect(pdf).toBe(FAKE_PDF);
    expect(fileName).toContain("pgr");

    const html = lastHtml();
    const nr09 = html.indexOf("3. Avaliação quantitativa de agentes (NR-09)");
    const nr17 = html.indexOf("4. Avaliação ergonômica (NR-17)");
    const plan = html.indexOf("5. Plano de ação (5W2H)");
    expect(nr09).toBeGreaterThan(-1);
    expect(nr17).toBeGreaterThan(nr09);
    expect(plan).toBeGreaterThan(nr17);
  });

  it("rota síncrona imprime os dados reais da avaliação ergonômica", async () => {
    await generatePgrPdf("org_a", PGR_IDS.pgrA);
    const html = lastHtml();
    expect(html).toContain("2026-06-01");
    expect(html).toContain("Ergonomista Beltrana");
    expect(html).toContain("Bancada abaixo do cotovelo");
    expect(html).toContain("Reavaliar em 6 meses");
    expect(html).toContain("Inadequado");
    expect(html).toContain("Não aplicável");
    expect(html).toContain("Não avaliado");
  });

  it("o agregado psicossocial aparece sem escore inventado e sem resposta individual", async () => {
    await generatePgrPdf("org_a", PGR_IDS.pgrA);
    const html = lastHtml();
    expect(html).toContain("Resultado agregado da campanha psicossocial");
    expect(html).toContain("Clima 2026");
    expect(html).toContain("2026-01-01 a 2026-03-31");
    expect(html).toContain("Ritmo de trabalho");
    expect(html).not.toMatch(/escore/i);

    const responses = await admin.unsafe(
      `select id::text from public.psychosocial_responses where campaign_id = '${CAMPAIGN_ID}'`,
    );
    expect(responses.length).toBe(3);
    for (const row of responses) expect(html).not.toContain(String(row.id));
  });

  it("worker produz o MESMO conteúdo da rota e marca o documento como ready", async () => {
    await generatePgrPdf("org_a", PGR_IDS.pgrA);
    const fromRoute = lastHtml();

    const result = await processPdfBatchJob(job());
    const fromWorker = lastHtml();
    expect(result.documentId).toBe(DOCUMENT_ID);

    for (const excerpt of [
      "4. Avaliação ergonômica (NR-17)",
      "Ergonomista Beltrana",
      "Resultado agregado da campanha psicossocial",
      "Bancada abaixo do cotovelo",
    ]) {
      expect(fromRoute).toContain(excerpt);
      expect(fromWorker).toContain(excerpt);
    }

    const [doc] = await admin.unsafe(
      `select status from public.documents where id = '${DOCUMENT_ID}'`,
    );
    expect(doc.status).toBe("ready");
  });

  it("risco sem avaliação ergonômica sai como ausência declarada, nunca como conforme", async () => {
    await admin.unsafe(`delete from public.ergonomic_evaluations where org_id = 'org_a'`);
    await generatePgrPdf("org_a", PGR_IDS.pgrA);
    const html = lastHtml();
    expect(html).toContain("Sem avaliação ergonômica registrada");
    expect(html).not.toContain("Resultado agregado da campanha psicossocial");
  });

  it("seção Relação de EPIs sai deduplicada, com dados do cadastro (#48)", async () => {
    const risk2 = "11111111-1111-1111-1111-1111111111b4";
    await admin.unsafe(`
      update public.epi_catalog
        set ca='12345', ca_valid_until='2020-01-01', manufacturer='Acme EPI',
            norm='ABNT NBR 16077', material='Silicone', size='Único',
            unit_of_measure='par', useful_life_months=12
      where org_id='org_a' and id='${PGR_IDS.epiCatalogA}';

      insert into public.risks (id, org_id, ges_id, agent_type, description) values
        ('${risk2}','org_a','${PGR_IDS.gesA}','chemical','Poeira de cimento');
      insert into public.epi_risk (org_id, catalog_id, risk_id, neutralization) values
        ('org_a','${PGR_IDS.epiCatalogA}','${risk2}','neutralizes');
    `);

    await generatePgrPdf("org_a", PGR_IDS.pgrA);
    const html = lastHtml();
    const section = sectionOf(html, "6. Relação de EPIs");
    // Uma linha por EPI, mesmo atendendo a dois riscos.
    expect(section.split("Capacete CA-123").length - 1).toBe(1);
    expect(section).toContain("CA 12345");
    expect(section).toContain("CA vencido");
    expect(section).toContain("Acme EPI");
    expect(section).toContain("GES A — Ruído contínuo");
    expect(section).toContain("GES A — Poeira de cimento");
    expect(section).toContain("Dados derivados do cadastro de EPIs");
  });

  it("PGR sem EPI vinculado declara a ausência na seção de EPIs", async () => {
    await admin.unsafe(`delete from public.epi_risk where org_id = 'org_a'`);
    await generatePgrPdf("org_a", PGR_IDS.pgrA);
    expect(lastHtml()).toContain("Nenhum EPI vinculado aos riscos deste PGR");
  });

  it("worker entrega a seção de EPIs igual à da rota", async () => {
    await generatePgrPdf("org_a", PGR_IDS.pgrA);
    const fromRoute = lastHtml();
    await processPdfBatchJob(job());
    const fromWorker = lastHtml();
    expect(fromRoute).toContain("6. Relação de EPIs");
    expect(fromWorker).toContain("6. Relação de EPIs");
    expect(fromWorker).toContain("Dados derivados do cadastro de EPIs");
  });

  it("PGR de outro tenant não gera documento (NOT_FOUND)", async () => {
    await expect(generatePgrPdf("org_a", PGR_IDS.pgrB)).rejects.toThrow();
    expect(htmlToPdf).not.toHaveBeenCalled();
  });
});
