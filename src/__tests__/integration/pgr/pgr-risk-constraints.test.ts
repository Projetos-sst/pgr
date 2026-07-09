import postgres from "postgres";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!ADMIN_URL;

(shouldRun ? describe : describe.skip)(
  "Riscos & PGR — CHECK, UNIQUE, FK e ON DELETE (modelo 0012)",
  () => {
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
    });

    it("CHECK probabilidade/severidade 1–5: fora da faixa é rejeitado", async () => {
      await expect(
        admin`insert into public.risk_assessments
          (org_id, risk_id, criterion, probability, severity, risk_level)
          values ('org_a', ${I.riskA}, 'qualitative', 0, 3, 0)`,
      ).rejects.toThrow();
      await expect(
        admin`insert into public.risk_assessments
          (org_id, risk_id, criterion, probability, severity, risk_level)
          values ('org_a', ${I.riskA}, 'qualitative', 3, 6, 18)`,
      ).rejects.toThrow();
    });

    it("CHECK coerência: risk_level != probabilidade × severidade é rejeitado", async () => {
      await expect(
        admin`insert into public.risk_assessments
          (org_id, risk_id, criterion, probability, severity, risk_level)
          values ('org_a', ${I.riskA}, 'qualitative', 3, 3, 10)`,
      ).rejects.toThrow();
      // caminho feliz: 3 × 3 = 9 é aceito
      await expect(
        admin`insert into public.risk_assessments
          (org_id, risk_id, criterion, probability, severity, risk_level)
          values ('org_a', ${I.riskA}, 'quantitative', 3, 3, 9)`,
      ).resolves.toBeDefined();
    });

    it("CHECK grau de incerteza 0–2: fora da faixa é rejeitado", async () => {
      await expect(
        admin`insert into public.risk_assessments
          (org_id, risk_id, criterion, probability, severity, risk_level, uncertainty_degree)
          values ('org_a', ${I.riskA}, 'qualitative', 2, 2, 4, 3)`,
      ).rejects.toThrow();
    });

    it("UNIQUE(org_id, risk_id, control_level): nível duplicado por risco é rejeitado", async () => {
      // seed já tem (riskA, elimination)
      await expect(
        admin`insert into public.control_measures (org_id, risk_id, control_level)
          values ('org_a', ${I.riskA}, 'elimination')`,
      ).rejects.toThrow();
    });

    it("UNIQUE(org_id, pgr_id, ges_id): vínculo PGR↔GES duplicado é rejeitado", async () => {
      await expect(
        admin`insert into public.pgr_ges (org_id, pgr_id, ges_id)
          values ('org_a', ${I.pgrA}, ${I.gesA})`,
      ).rejects.toThrow();
    });

    it("UNIQUE(org_id, pgr_id, revision_number): número de revisão duplicado é rejeitado", async () => {
      await expect(
        admin`insert into public.pgr_revisions (org_id, pgr_id, revision_number)
          values ('org_a', ${I.pgrA}, 1)`,
      ).rejects.toThrow();
    });

    it("enum risk_agent_type fechado: valor fora do conjunto é rejeitado", async () => {
      await expect(
        admin.unsafe(`insert into public.risks (org_id, ges_id, agent_type, description)
          values ('org_a', '${I.gesA}', 'radioactive', 'x')`),
      ).rejects.toThrow();
    });

    it("FK risks.ges_id: GES inexistente é rejeitado", async () => {
      await expect(
        admin`insert into public.risks (org_id, ges_id, agent_type, description)
          values ('org_a', '99999999-9999-9999-9999-999999999999', 'physical', 'x')`,
      ).rejects.toThrow();
    });

    it("ON DELETE CASCADE: excluir o GES remove riscos, avaliações e medidas", async () => {
      await admin`delete from public.ges where id = ${I.gesA}`;
      const risks = await admin<{ id: string }[]>`
        select id from public.risks where id = ${I.riskA}`;
      const assessments = await admin<{ id: string }[]>`
        select id from public.risk_assessments where id = ${I.riskAssessmentA}`;
      const measures = await admin<{ id: string }[]>`
        select id from public.control_measures where id = ${I.controlMeasureA}`;
      expect(risks).toHaveLength(0);
      expect(assessments).toHaveLength(0);
      expect(measures).toHaveLength(0);
    });

    it("ON DELETE CASCADE: excluir o PGR remove vínculos de GES e revisões", async () => {
      await admin`delete from public.pgr where id = ${I.pgrA}`;
      const links = await admin<{ id: string }[]>`
        select id from public.pgr_ges where id = ${I.pgrGesA}`;
      const revisions = await admin<{ id: string }[]>`
        select id from public.pgr_revisions where id = ${I.pgrRevisionA}`;
      expect(links).toHaveLength(0);
      expect(revisions).toHaveLength(0);
    });

    it("ON DELETE SET NULL: excluir a obra (work_unit) preserva o PGR e zera work_unit_id", async () => {
      await admin`delete from public.work_units where id = ${I.workUnitA}`;
      const [row] = await admin<{ id: string; work_unit_id: string | null }[]>`
        select id, work_unit_id from public.pgr where id = ${I.pgrA}`;
      expect(row).toBeDefined();
      expect(row.work_unit_id).toBeNull();
    });
  },
);
