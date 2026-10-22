/** Representative fictional cases for technical review; automatic assertions are not a technical opinion. */
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("@/shared/integrations/storage/company-logo-storage", () => ({
  downloadCompanyLogo: jest.fn().mockResolvedValue(null),
}));

import type postgres from "postgres";
import { generatePgrDocx } from "@/shared/server/platform/pgr-docx-core";
import {
  extractDocxText,
  findLeftoverMarkers,
} from "@/shared/integrations/docx/template-engine";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
// The document uses nonbreaking spaces and split OOXML runs for layout.
const visible = (text: string) => text.replace(/\s/g, "").toLocaleLowerCase("pt-BR");
(enabled ? describe : describe.skip)("NOB-107 fictional review samples", () => {
  let admin: ReturnType<typeof postgres>;
  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages = warning`;
    await applyMigrations(admin);
  });
  afterAll(async () => {
    await admin?.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
  });

  it.each([
    ["physical", "Físico", "Agente físico fictício para revisão"],
    ["chemical", "Químico", "Agente químico fictício para revisão"],
    ["ergonomic", "Ergonômico", "Situação ergonômica fictícia para revisão"],
  ])(
    "maps a %s sample without mixing another company's inventory",
    async (agentType, label, description) => {
      await admin`update risks set agent_type = ${agentType}, description = ${description}, sources = 'Fonte fictícia registrada' where id = ${I.riskA}`;
      await admin`update risks set description = 'CONTEÚDO RESTRITO DA EMPRESA B' where id = ${I.riskB}`;
      const generated = await generatePgrDocx("org_a", I.pgrA);
      const text = extractDocxText(generated.file);
      expect(visible(text)).toContain(visible(label));
      expect(visible(text)).toContain(visible(description));
      expect(visible(text)).toContain(visible("Fonte fictícia registrada"));
      expect(visible(text)).not.toContain(visible("CONTEÚDO RESTRITO DA EMPRESA B"));
      expect(findLeftoverMarkers(text)).toEqual([]);
      await expect(generatePgrDocx("org_b", I.pgrA)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    },
  );

  it("keeps missing assessment explicit rather than representing it as approval", async () => {
    await admin`delete from risk_assessments where risk_id = ${I.riskA}`;
    const generated = await generatePgrDocx("org_a", I.pgrA);
    expect(extractDocxText(generated.file)).toContain("Não avaliado");
  });

  it("excludes an unlinked GES and another company's inventory inside the same office", async () => {
    const [otherCompany] =
      await admin`insert into companies (org_id, razao_social) values ('org_a', 'OUTRA EMPRESA NO MESMO ESCRITÓRIO') returning id`;
    const [unit] =
      await admin`insert into work_units (org_id, company_id, name, description) values ('org_a', ${otherCompany.id}, 'Outra unidade', 'Ambiente fictício de teste') returning id`;
    const [otherGes] =
      await admin`insert into ges (org_id, company_id, work_unit_id, name) values ('org_a', ${otherCompany.id}, ${unit.id}, 'Outro GES') returning id`;
    const [unlinked] =
      await admin`insert into ges (org_id, company_id, work_unit_id, name) values ('org_a', ${I.companyA}, ${I.workUnitA}, 'GES não vinculado ao PGR') returning id`;
    await admin`insert into risks (org_id, ges_id, agent_type, description) values ('org_a', ${otherGes.id}, 'physical', 'RISCO DE OUTRA EMPRESA INTERNA'), ('org_a', ${unlinked.id}, 'chemical', 'RISCO DE GES NÃO VINCULADO')`;
    const file = await generatePgrDocx("org_a", I.pgrA);
    const text = visible(extractDocxText(file.file));
    expect(text).not.toContain(visible("RISCO DE OUTRA EMPRESA INTERNA"));
    expect(text).not.toContain(visible("RISCO DE GES NÃO VINCULADO"));
    expect(text).toContain(visible("Ruído contínuo"));
  });

  it("maps the latest persisted quantitative assessment and its units instead of stale reference values", async () => {
    await admin`update risks set measurement_unit = 'db_a', concentration_intensity = 41 where id = ${I.riskA}`;
    await admin`update risk_assessments set criterion = 'quantitative', probability = 3, severity = 4, risk_level = 12, result = 'moderate', measured_value = 87.5, measured_unit = 'db_a', tolerance_limit_value = 85, assessed_at = '2026-01-01' where id = ${I.riskAssessmentA}`;
    const first = await generatePgrDocx("org_a", I.pgrA);
    expect(visible(extractDocxText(first.file))).toContain(
      visible("Resultado Encontrado: 87,5 dB(A)"),
    );
    expect(visible(extractDocxText(first.file))).toContain(
      visible("Limite de Tolerância: 85 dB(A)"),
    );
    await admin`insert into risk_assessments (org_id, risk_id, criterion, probability, severity, risk_level, result, measured_value, measured_unit, tolerance_limit_value, assessed_at) values ('org_a', ${I.riskA}, 'quantitative', 4, 4, 16, 'substantial', 91.7, 'db_a', 85, '2026-10-20')`;
    const regenerated = await generatePgrDocx("org_a", I.pgrA);
    const text = visible(extractDocxText(regenerated.file));
    expect(text).toContain(visible("Resultado Encontrado: 91,7 dB(A)"));
    expect(text).not.toContain(visible("Resultado Encontrado: 87,5 dB(A)"));
    expect(text).not.toContain(visible("Resultado Encontrado: 41 dB(A)"));
    expect(text).toContain(visible("Gradação da Probabilidade (X): 4"));
    expect(text).toContain(visible("Severidade dos Efeitos à Saúde (Y): 4"));
  });

  it("preserves the revision sequence and notes in the generated document", async () => {
    await admin`update pgr_revisions set notes = 'REVISÃO FICTÍCIA INICIAL' where id = ${I.pgrRevisionA}`;
    await admin`insert into pgr_revisions (org_id, pgr_id, revision_number, notes, revised_at) values ('org_a', ${I.pgrA}, 2, 'CORREÇÃO FICTÍCIA DOCUMENTADA', '2026-10-20')`;
    const generated = await generatePgrDocx("org_a", I.pgrA);
    const text = visible(extractDocxText(generated.file));
    const initial = text.indexOf(visible("REVISÃO FICTÍCIA INICIAL"));
    const revised = text.indexOf(visible("CORREÇÃO FICTÍCIA DOCUMENTADA"));
    expect(initial).toBeGreaterThanOrEqual(0);
    expect(revised).toBeGreaterThan(initial);
  });

  it("regenerates a corrected description while preserving the previous exported bytes", async () => {
    await admin`update risks set description = 'Texto fictício antes da revisão' where id = ${I.riskA}`;
    const before = await generatePgrDocx("org_a", I.pgrA);
    const savedBytes = Buffer.from(before.file);
    await admin`update risks set description = 'Texto fictício corrigido para revalidação' where id = ${I.riskA}`;
    const after = await generatePgrDocx("org_a", I.pgrA);
    expect(visible(extractDocxText(after.file))).toContain(
      visible("Texto fictício corrigido para revalidação"),
    );
    expect(visible(extractDocxText(after.file))).not.toContain(
      visible("Texto fictício antes da revisão"),
    );
    expect(before.file.equals(savedBytes)).toBe(true);
    expect(visible(extractDocxText(before.file))).toContain(
      visible("Texto fictício antes da revisão"),
    );
  });
});
