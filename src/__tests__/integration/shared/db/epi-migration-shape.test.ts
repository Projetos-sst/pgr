import postgres from "postgres";

import { adminClient, applyMigrations } from "../../_helpers/db";
import { seedPgrBase } from "../../_helpers/pgr-seed";

const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!ADMIN_URL;

const EPI_TABLES = [
  "epi_catalog",
  "epi_stock",
  "stock_movements",
  "epi_deliveries",
  "epi_delivery_items",
  "epi_risk",
] as const;

const ENUMS: Record<string, string[]> = {
  stock_movement_type: ["purchase", "employee_delivery", "adjustment", "discard"],
  epi_signature_status: ["pending", "signed_qr", "signed_link", "signed_manual"],
};

(shouldRun ? describe : describe.skip)(
  "EPI — forma/conformidade da migration 0007 (introspecção)",
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

    it.each(EPI_TABLES)("%s tem RLS habilitado", async (table) => {
      const [row] = await admin<{ relrowsecurity: boolean }[]>`
        select relrowsecurity from pg_class
        where relname = ${table} and relnamespace = 'public'::regnamespace`;
      expect(row.relrowsecurity).toBe(true);
    });

    it.each(EPI_TABLES)("%s tem policy <t>_isolation para app_runtime", async (table) => {
      const rows = await admin<{ policyname: string }[]>`
        select policyname from pg_policies
        where schemaname = 'public' and tablename = ${table}
          and policyname = ${`${table}_isolation`}
          and 'app_runtime' = any(roles)`;
      expect(rows).toHaveLength(1);
    });

    it.each(EPI_TABLES)(
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

    it.each(EPI_TABLES)("%s tem trigger set_updated_at_<t>", async (table) => {
      const rows = await admin<{ tgname: string }[]>`
        select tgname from pg_trigger where tgname = ${`set_updated_at_${table}`}`;
      expect(rows).toHaveLength(1);
    });

    it.each(EPI_TABLES)("%s tem org_id NOT NULL e indexado", async (table) => {
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

    it("epi_catalog reusa categories via FK composta (category_id, type) → categories(id, type)", async () => {
      // FR-002a: a FK passou a ser composta (garante item.type == categoria.type).
      const rows = await admin<{ foreign_table_name: string; column_name: string }[]>`
        select ccu.table_name as foreign_table_name, ccu.column_name
        from information_schema.table_constraints tc
        join information_schema.constraint_column_usage ccu
          on ccu.constraint_name = tc.constraint_name
        where tc.table_name = 'epi_catalog' and tc.constraint_type = 'FOREIGN KEY'
          and tc.constraint_name = 'epi_catalog_category_id_type_fk'`;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.foreign_table_name === "categories")).toBe(true);
      const cols = rows.map((r) => r.column_name).sort();
      expect(cols).toEqual(["id", "type"]);
    });
  },
);
