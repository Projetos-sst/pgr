import postgres from "postgres";

import { adminClient, applyMigrations, withOrgTx } from "./db";
import { seedPgrBase } from "./pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

type OrgRow = { org_id: string };

export type IsolationSuiteOptions = {
  table: string;
  /** Rows visible to org_a after the base seed (one chain per tenant → 1). */
  seededCountA: number;
  /** INSERT marked for org_b; must be rejected by WITH CHECK when org_a is active. */
  crossTenantInsertSql: string;
};

export function runIsolationSuite(opts: IsolationSuiteOptions): void {
  const { table, seededCountA, crossTenantInsertSql } = opts;

  (shouldRun ? describe : describe.skip)(
    `US1 — ${table} isolation (RLS backstop por org_id)`,
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
        await seedPgrBase(admin);
      });

      it("tenant A fixado, select SEM where → só linhas de A", async () => {
        const rows = await withOrgTx(
          runtime,
          "org_a",
          (tx) => tx<OrgRow[]>`select org_id from public.${tx(table)}`,
        );
        expect(rows).toHaveLength(seededCountA);
        expect(rows.every((r) => r.org_id === "org_a")).toBe(true);
      });

      it("tenant B fixado → só linhas de B", async () => {
        const rows = await withOrgTx(
          runtime,
          "org_b",
          (tx) => tx<OrgRow[]>`select org_id from public.${tx(table)}`,
        );
        expect(rows.every((r) => r.org_id === "org_b")).toBe(true);
        expect(rows.length).toBeGreaterThan(0);
      });

      it("sem tenant fixado (query bare) → 0 linhas", async () => {
        const rows = await runtime<OrgRow[]>`select org_id from public.${runtime(table)}`;
        expect(rows).toHaveLength(0);
      });

      it("tenant inexistente/inválido → 0 linhas", async () => {
        const rows = await withOrgTx(
          runtime,
          "org_does_not_exist",
          (tx) => tx<OrgRow[]>`select org_id from public.${tx(table)}`,
        );
        expect(rows).toHaveLength(0);
      });

      it("escrita cross-tenant (org_id ≠ ativo) é rejeitada pelo WITH CHECK", async () => {
        await expect(
          withOrgTx(runtime, "org_a", (tx) => tx.unsafe(crossTenantInsertSql)),
        ).rejects.toThrow();
      });

      it("após withOrg(A), uma query bare subsequente não vaza o escopo", async () => {
        await withOrgTx(
          runtime,
          "org_a",
          (tx) => tx<OrgRow[]>`select org_id from public.${tx(table)}`,
        );
        const rows = await runtime<OrgRow[]>`select org_id from public.${runtime(table)}`;
        expect(rows).toHaveLength(0);
      });
    },
  );
}
