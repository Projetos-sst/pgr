/**
 * PGR em DOCX pelo template (`templates/pgr/pgr-template.docx`) com dados REAIS do
 * Postgres efêmero: leitura consolidada + extras (caracterização do GES, funções,
 * revisões, matriz de treinamentos) → docxtemplater. Gotenberg e Storage são mockados;
 * o template e o motor de preenchimento são os de verdade.
 */
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

const docxToPdf = jest.fn();
const downloadCompanyLogo = jest.fn();

jest.mock("@/shared/integrations/pdf/gotenberg", () => ({
  docxToPdf: (...a: unknown[]) => docxToPdf(...a),
}));
jest.mock("@/shared/integrations/storage/company-logo-storage", () => ({
  downloadCompanyLogo: (...a: unknown[]) => downloadCompanyLogo(...a),
}));
jest.mock("@/shared/integrations/storage/documents-storage", () => ({
  slugifyFileName: (name: string) => name.toLowerCase().replace(/[^a-z0-9.]+/g, "-"),
}));

import type postgres from "postgres";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { getPgrDocxExtras } from "@/shared/db/repositories/pgr-docx-extras";
import {
  extractDocxText,
  findLeftoverMarkers,
} from "@/shared/integrations/docx/template-engine";
import { generatePgrDocx } from "@/shared/server/platform/pgr-docx-core";

import { adminClient, applyMigrations } from "../_helpers/db";
import { PGR_IDS, seedPgrBase } from "../_helpers/pgr-seed";

const shouldRun =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;

const TRAINING_A = "11111111-1111-1111-1111-1111111111c1";
const TRAINING_B = "22222222-2222-2222-2222-2222222222c1";
const FAKE_PDF = Buffer.from("%PDF-1.4 fake");

(shouldRun ? describe : describe.skip)("PGR em DOCX pelo template", () => {
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
    docxToPdf.mockReset().mockResolvedValue(FAKE_PDF);
    downloadCompanyLogo.mockReset().mockResolvedValue(null);

    await admin.unsafe(`
      update public.companies set phone = '(11) 4000-0000', risk_grade = 3
        where id = '${PGR_IDS.companyA}';
      update public.work_units set contract_number = 'CT-77/2026', manager_name = 'Preposto A'
        where id = '${PGR_IDS.workUnitA}';
      update public.ges set process_description = 'Concretagem de lajes', floor = 'Concreto'
        where id = '${PGR_IDS.gesA}';
      update public.job_roles set description = 'Executa alvenaria'
        where id = '${PGR_IDS.jobRoleA}';
      update public.pgr set responsible = 'Eng. Fulano', issued_at = '2026-10-01',
        valid_until = '2028-09-30' where id = '${PGR_IDS.pgrA}';
      update public.pgr_revisions set notes = '01 - Revisão anual'
        where id = '${PGR_IDS.pgrRevisionA}';

      insert into public.training_catalog
        (id, org_id, number, name, reference_norm, workload_hours, periodicity) values
        ('${TRAINING_A}','org_a',1,'Trabalho em altura','NR 35',8,'biennial'),
        ('${TRAINING_B}','org_b',1,'Espaço confinado','NR 33',16,'annual');
      insert into public.job_role_required_trainings (org_id, job_role_id, training_id) values
        ('org_a','${PGR_IDS.jobRoleA}','${TRAINING_A}'),
        ('org_b','${PGR_IDS.jobRoleB}','${TRAINING_B}');
    `);
  });

  it("preenche o template com os dados do tenant, sem marcador sobrando", async () => {
    const result = await generatePgrDocx("org_a", PGR_IDS.pgrA);

    expect(result.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(result.fileName).toMatch(/^pgr-a-ltda-wu-a-\d{4}-\d{2}-\d{2}\.docx$/);
    const text = extractDocxText(result.file).replace(/\u00A0/g, " ");
    expect(findLeftoverMarkers(text)).toEqual([]);
    for (const expected of [
      "A LTDA",
      "11.222.333/0001-81",
      "(11) 4000-0000",
      "CT-77/2026",
      "Preposto A",
      "Eng. Fulano",
      "01 - Revisão anual",
      "10/2026 a 09/2028",
      "GES A",
      "Concretagem de lajes",
      "Pedreiro",
      "Executa alvenaria",
      "Ruído contínuo",
      "Capacete CA-123",
      "NR 35",
      // semi-fixo com o valor padrão
      "1 - INTRODUÇÃO",
    ]) {
      expect(text).toContain(expected);
    }
    // nada do outro tenant
    expect(text).not.toContain("B LTDA");
    expect(text).not.toContain("NR 33");
    expect(docxToPdf).not.toHaveBeenCalled();
  });

  it("aplica os semi-fixos alterados (overrides) no lugar dos padrões", async () => {
    const result = await generatePgrDocx("org_a", PGR_IDS.pgrA, {
      overrides: {
        titles: { introduction: "1 - APRESENTAÇÃO" },
        texts: { objective: "Objetivo próprio da obra." },
      },
    });
    const text = extractDocxText(result.file).replace(/\u00A0/g, " ");
    expect(text).toContain("1 - APRESENTAÇÃO");
    expect(text).not.toContain("1 - INTRODUÇÃO");
    expect(text).toContain("Objetivo próprio da obra.");
  });

  it("formato pdf converte o DOCX preenchido pelo provedor (Gotenberg)", async () => {
    const result = await generatePgrDocx("org_a", PGR_IDS.pgrA, { format: "pdf" });

    expect(result.contentType).toBe("application/pdf");
    expect(result.fileName).toMatch(/\.pdf$/);
    expect(result.file).toEqual(FAKE_PDF);
    expect(docxToPdf).toHaveBeenCalledTimes(1);
    const [docx, name] = docxToPdf.mock.calls[0] as [Buffer, string];
    expect(name).toMatch(/\.docx$/);
    expect(extractDocxText(docx)).toContain("A LTDA");
  });

  it("PGR de outro tenant → NOT_FOUND (sem vazar dado)", async () => {
    await expect(generatePgrDocx("org_b", PGR_IDS.pgrA)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(getPgrDocxExtras("org_b", PGR_IDS.pgrA)).resolves.toBeNull();
  });

  it("extras trazem caracterização, funções, revisões e treinamentos só do tenant", async () => {
    const extras = await getPgrDocxExtras("org_a", PGR_IDS.pgrA);

    expect(extras?.company.phone).toBe("(11) 4000-0000");
    expect(extras?.revisions).toEqual([
      { revisionNumber: 1, revisedAt: expect.any(String), notes: "01 - Revisão anual" },
    ]);
    expect(extras?.ges[PGR_IDS.gesA]).toMatchObject({
      processDescription: "Concretagem de lajes",
      floor: "Concreto",
      jobRoles: [{ id: PGR_IDS.jobRoleA, title: "Pedreiro", workerCount: 3 }],
    });
    expect(extras?.requiredTrainings).toEqual([
      { jobRoleId: PGR_IDS.jobRoleA, trainingId: TRAINING_A, label: "NR 35" },
    ]);
  });
});
