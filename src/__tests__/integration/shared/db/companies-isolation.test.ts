import postgres from "postgres";

import { adminClient, applyMigrations, withOrgTx } from "../../_helpers/db";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

type CompanyRow = { org_id: string };

(shouldRun ? describe : describe.skip)(
  "US2 — companies isolation (RLS backstop por org_id)",
  () => {
    let admin: ReturnType<typeof postgres>;
    let runtime: ReturnType<typeof postgres>;

    beforeAll(async () => {
      admin = adminClient();
      await applyMigrations(admin);
      runtime = postgres(APP_RUNTIME_URL!, { max: 1, prepare: false });
    });

    afterAll(async () => {
      await runtime.end({ timeout: 5 });
      await admin.end({ timeout: 5 });
    });

    beforeEach(async () => {
      await admin.unsafe(
        "truncate table public.companies, public.org_memberships, public.orgs, public.users restart identity cascade;",
      );
      await admin.unsafe(`
        insert into public.orgs (id, plan) values ('org_a','free'), ('org_b','pro');
        insert into public.companies (org_id, cnpj, razao_social) values
          ('org_a','11111111000111','A1 Ltda'),
          ('org_a','22222222000122','A2 Ltda'),
          ('org_b','33333333000133','B1 Ltda');
      `);
    });

    it("tenant A fixado, select SEM where → só linhas de A", async () => {
      const rows = await withOrgTx(
        runtime,
        "org_a",
        (tx) => tx<CompanyRow[]>`select org_id from public.companies`,
      );
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.org_id === "org_a")).toBe(true);
    });

    it("tenant B fixado → só linhas de B", async () => {
      const rows = await withOrgTx(
        runtime,
        "org_b",
        (tx) => tx<CompanyRow[]>`select org_id from public.companies`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].org_id).toBe("org_b");
    });

    it("sem tenant fixado (query bare) → 0 linhas", async () => {
      const rows = await runtime<CompanyRow[]>`select org_id from public.companies`;
      expect(rows).toHaveLength(0);
    });

    it("tenant inexistente/inválido → 0 linhas", async () => {
      const rows = await withOrgTx(
        runtime,
        "org_does_not_exist",
        (tx) => tx<CompanyRow[]>`select org_id from public.companies`,
      );
      expect(rows).toHaveLength(0);
    });

    it("escrita cross-tenant (org_id ≠ ativo) é rejeitada pelo WITH CHECK", async () => {
      await expect(
        withOrgTx(
          runtime,
          "org_a",
          (tx) =>
            tx`insert into public.companies (org_id, cnpj) values ('org_b','44444444000144')`,
        ),
      ).rejects.toThrow();
    });

    it("após withOrg(A), uma query bare subsequente não vaza o escopo", async () => {
      await withOrgTx(
        runtime,
        "org_a",
        (tx) => tx<CompanyRow[]>`select org_id from public.companies`,
      );
      const rows = await runtime<CompanyRow[]>`select org_id from public.companies`;
      expect(rows).toHaveLength(0);
    });
  },
);
