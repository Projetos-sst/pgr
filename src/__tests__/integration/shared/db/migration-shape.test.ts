import postgres from "postgres";

import { adminClient, applyMigrations } from "../../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../../_helpers/pgr-seed";

const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!ADMIN_URL;

const NEW_TABLES = [
  "work_units",
  "ges",
  "job_roles",
  "categories",
  "employees",
  "ges_job_roles",
] as const;

const ENUMS: Record<string, string[]> = {
  category_type: ["epi", "machine"],
  employee_sex: ["male", "female", "not_informed"],
  marital_status: ["single", "married", "divorced", "widowed", "stable_union"],
  employee_status: ["active", "on_leave", "dismissed"],
};

(shouldRun ? describe : describe.skip)(
  "US4 — forma/conformidade da migration 0005 (introspecção)",
  () => {
    let admin: ReturnType<typeof postgres>;

    beforeAll(async () => {
      admin = adminClient();
      await applyMigrations(admin);
      await seedPgrBase(admin);
    });

    afterAll(async () => {
      await admin.end({ timeout: 5 });
    });

    it.each(NEW_TABLES)("%s tem RLS habilitado", async (table) => {
      const [row] = await admin<{ relrowsecurity: boolean }[]>`
        select relrowsecurity from pg_class
        where relname = ${table} and relnamespace = 'public'::regnamespace`;
      expect(row.relrowsecurity).toBe(true);
    });

    it.each(NEW_TABLES)("%s tem policy <t>_isolation para app_runtime", async (table) => {
      const rows = await admin<{ policyname: string }[]>`
        select policyname from pg_policies
        where schemaname = 'public' and tablename = ${table}
          and policyname = ${`${table}_isolation`}
          and 'app_runtime' = any(roles)`;
      expect(rows).toHaveLength(1);
    });

    it.each(NEW_TABLES)(
      "%s concede SELECT/INSERT/UPDATE/DELETE a app_runtime",
      async (table) => {
        const rows = await admin<{ privilege_type: string }[]>`
        select privilege_type from information_schema.role_table_grants
        where grantee = 'app_runtime' and table_schema = 'public' and table_name = ${table}`;
        const granted = new Set(rows.map((r) => r.privilege_type));
        for (const priv of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
          expect(granted.has(priv)).toBe(true);
        }
      },
    );

    it.each(NEW_TABLES)("%s tem trigger set_updated_at_<t>", async (table) => {
      const rows = await admin<{ tgname: string }[]>`
        select tgname from pg_trigger where tgname = ${`set_updated_at_${table}`}`;
      expect(rows).toHaveLength(1);
    });

    it.each(Object.entries(ENUMS))(
      "enum %s tem os membros esperados",
      async (name, members) => {
        const rows = await admin<{ enumlabel: string }[]>`
        select enumlabel from pg_enum e
        join pg_type t on t.oid = e.enumtypid
        where t.typname = ${name} order by e.enumsortorder`;
        expect(rows.map((r) => r.enumlabel)).toEqual(members);
      },
    );

    it("companies.razao_social é NOT NULL", async () => {
      const [row] = await admin<{ is_nullable: string }[]>`
        select is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = 'companies'
          and column_name = 'razao_social'`;
      expect(row.is_nullable).toBe("NO");
    });

    it("trigger set_updated_at avança updated_at em UPDATE (sobrepõe valor manual)", async () => {
      await admin`update public.companies set updated_at = '2000-01-01T00:00:00Z'
                  where id = ${I.companyA}`;
      const [row] = await admin<{ updated_at: Date }[]>`
        select updated_at from public.companies where id = ${I.companyA}`;
      expect(row.updated_at.getUTCFullYear()).toBeGreaterThan(2000);
    });
  },
);
