import postgres from "postgres";

import { adminClient, applyMigrations } from "../../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../../_helpers/pgr-seed";

const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!ADMIN_URL;

(shouldRun ? describe : describe.skip)(
  "US2 — unicidade, CHECK e enums dos cadastros PGR",
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

    it("UNIQUE(org_id, cpf): bloqueia CPF duplicado na mesma org", async () => {
      await expect(
        admin`insert into public.employees (org_id, company_id, full_name, cpf)
              values ('org_a', ${I.companyA}, 'Outro', '12345678901')`,
      ).rejects.toThrow();
    });

    it("UNIQUE(org_id, cpf): permite o mesmo CPF em orgs distintas", async () => {
      await expect(
        admin`insert into public.employees (org_id, company_id, full_name, cpf)
              values ('org_b', ${I.companyB}, 'Outro', '12345678901')`,
      ).resolves.toBeDefined();
    });

    it("CNPJ não é único global: mesmo CNPJ em A e B coexiste", async () => {
      await expect(
        admin`insert into public.companies (org_id, cnpj, razao_social)
              values ('org_b', '11111111000111', 'Homônima em B')`,
      ).resolves.toBeDefined();
    });

    it("UNIQUE(org_id, ges_id, job_role_id): associação não duplica", async () => {
      await expect(
        admin`insert into public.ges_job_roles (org_id, ges_id, job_role_id, worker_count)
              values ('org_a', ${I.gesA}, ${I.jobRoleA}, 5)`,
      ).rejects.toThrow();
    });

    it("UNIQUE(org_id, company_id, title): função não duplica por nome na empresa", async () => {
      await expect(
        admin`insert into public.job_roles (org_id, company_id, title)
              values ('org_a', ${I.companyA}, 'Pedreiro')`,
      ).rejects.toThrow();
    });

    it("UNIQUE(org_id, type, name): categoria não duplica; mesmo nome em tipo distinto é aceito", async () => {
      await expect(
        admin`insert into public.categories (org_id, type, name)
              values ('org_a', 'epi', 'Capacete')`,
      ).rejects.toThrow();
      await expect(
        admin`insert into public.categories (org_id, type, name)
              values ('org_a', 'machine', 'Capacete')`,
      ).resolves.toBeDefined();
    });

    it("CHECK (worker_count > 0): valor <= 0 é rejeitado", async () => {
      const [role] = await admin<{ id: string }[]>`
        insert into public.job_roles (org_id, company_id, title)
        values ('org_a', ${I.companyA}, 'Servente') returning id`;
      await expect(
        admin`insert into public.ges_job_roles (org_id, ges_id, job_role_id, worker_count)
              values ('org_a', ${I.gesA}, ${role.id}, 0)`,
      ).rejects.toThrow();
    });

    it("CHECK (risk_grade between 1 and 4): fora da faixa é rejeitado; dentro é aceito", async () => {
      await expect(
        admin`update public.companies set risk_grade = 5 where id = ${I.companyA}`,
      ).rejects.toThrow();
      await expect(
        admin`update public.companies set risk_grade = 0 where id = ${I.companyA}`,
      ).rejects.toThrow();
      await expect(
        admin`update public.companies set risk_grade = 3 where id = ${I.companyA}`,
      ).resolves.toBeDefined();
    });

    it("enum fechado: valor fora do conjunto é rejeitado", async () => {
      await expect(
        admin.unsafe(
          `insert into public.categories (org_id, type, name) values ('org_a','vehicle','X')`,
        ),
      ).rejects.toThrow();
      await expect(
        admin.unsafe(
          `update public.employees set status = 'retired' where id = '${I.employeeA}'`,
        ),
      ).rejects.toThrow();
    });
  },
);
