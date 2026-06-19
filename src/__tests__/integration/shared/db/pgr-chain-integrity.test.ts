import postgres from "postgres";

import { adminClient, applyMigrations } from "../../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../../_helpers/pgr-seed";

const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!ADMIN_URL;
const MISSING = "00000000-0000-0000-0000-0000000000ff";

(shouldRun ? describe : describe.skip)(
  "US2 — integridade da cadeia PGR (FK + ON DELETE)",
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

    it("FK válida ao longo da cadeia foi aceita (seed completa)", async () => {
      const [{ count }] = await admin<{ count: string }[]>`
        select count(*)::text as count from public.ges where id = ${I.gesA}`;
      expect(count).toBe("1");
    });

    it("FK inválida em cada elo é rejeitada", async () => {
      await expect(
        admin`insert into public.work_units (org_id, company_id, name, description)
              values ('org_a', ${MISSING}, 'X', 'd')`,
      ).rejects.toThrow();
      await expect(
        admin`insert into public.ges (org_id, company_id, work_unit_id, name)
              values ('org_a', ${I.companyA}, ${MISSING}, 'X')`,
      ).rejects.toThrow();
      await expect(
        admin`insert into public.ges_job_roles (org_id, ges_id, job_role_id, worker_count)
              values ('org_a', ${MISSING}, ${I.jobRoleA}, 1)`,
      ).rejects.toThrow();
      await expect(
        admin`insert into public.employees (org_id, company_id, full_name, cpf)
              values ('org_a', ${MISSING}, 'X', '11100011100')`,
      ).rejects.toThrow();
    });

    it("apagar companies cascateia work_units/ges/ges_job_roles/employees", async () => {
      await admin`delete from public.companies where id = ${I.companyA}`;
      const tables = ["work_units", "ges", "ges_job_roles", "employees"] as const;
      for (const table of tables) {
        const [{ count }] = await admin<{ count: string }[]>`
          select count(*)::text as count from public.${admin(table)} where org_id = 'org_a'`;
        expect(count).toBe("0");
      }
      const [{ count: bKept }] = await admin<{ count: string }[]>`
        select count(*)::text as count from public.employees where org_id = 'org_b'`;
      expect(bKept).toBe("1");
    });

    it("apagar GES referenciado por employees → SET NULL (funcionário permanece)", async () => {
      await admin`delete from public.ges where id = ${I.gesA}`;
      const [row] = await admin<{ ges_id: string | null }[]>`
        select ges_id from public.employees where id = ${I.employeeA}`;
      expect(row).toBeDefined();
      expect(row.ges_id).toBeNull();
    });

    it("apagar job_roles referenciado por employees → SET NULL (funcionário permanece)", async () => {
      await admin`delete from public.job_roles where id = ${I.jobRoleA}`;
      const [row] = await admin<{ job_role_id: string | null }[]>`
        select job_role_id from public.employees where id = ${I.employeeA}`;
      expect(row).toBeDefined();
      expect(row.job_role_id).toBeNull();
    });
  },
);
