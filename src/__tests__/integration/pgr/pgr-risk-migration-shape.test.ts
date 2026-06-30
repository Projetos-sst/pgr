import postgres from "postgres";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!ADMIN_URL;

const PGR_TABLES = [
  "risks",
  "risk_assessments",
  "control_measures",
  "pgr",
  "pgr_ges",
  "pgr_revisions",
] as const;

const ENUMS: Record<string, string[]> = {
  risk_agent_type: [
    "physical",
    "chemical",
    "biological",
    "ergonomic",
    "mechanical",
    "accident",
    "psychosocial",
  ],
  exposure_time: [
    "lt_1h",
    "1_2h",
    "2_4h",
    "4_7h",
    "gt_7h",
    "eventual",
    "intermittent",
    "habitual",
  ],
  assessment_criterion: ["qualitative", "quantitative"],
  control_level: ["elimination", "collective_protection", "administrative", "ppe"],
  pgr_registration_type: ["crm", "crea", "mte", "not_applicable"],
};

(shouldRun ? describe : describe.skip)(
  "Riscos & PGR — forma/conformidade da migration 0012 (introspecção)",
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

    it.each(PGR_TABLES)("%s tem RLS habilitado", async (table) => {
      const [row] = await admin<{ relrowsecurity: boolean }[]>`
        select relrowsecurity from pg_class
        where relname = ${table} and relnamespace = 'public'::regnamespace`;
      expect(row.relrowsecurity).toBe(true);
    });

    it.each(PGR_TABLES)("%s tem policy <t>_isolation para app_runtime", async (table) => {
      const rows = await admin<{ policyname: string }[]>`
        select policyname from pg_policies
        where schemaname = 'public' and tablename = ${table}
          and policyname = ${`${table}_isolation`}
          and 'app_runtime' = any(roles)`;
      expect(rows).toHaveLength(1);
    });

    it.each(PGR_TABLES)(
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

    it.each(PGR_TABLES)("%s tem trigger set_updated_at_<t>", async (table) => {
      const rows = await admin<{ tgname: string }[]>`
        select tgname from pg_trigger where tgname = ${`set_updated_at_${table}`}`;
      expect(rows).toHaveLength(1);
    });

    it.each(PGR_TABLES)("%s tem org_id NOT NULL e indexado", async (table) => {
      const [col] = await admin<{ is_nullable: string }[]>`
        select is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = ${table} and column_name = 'org_id'`;
      expect(col.is_nullable).toBe("NO");
      const idx = await admin<{ indexname: string }[]>`
        select indexname from pg_indexes
        where schemaname = 'public' and tablename = ${table}
          and indexname = ${`idx_${table}_org_id`}`;
      expect(idx).toHaveLength(1);
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
  },
);
