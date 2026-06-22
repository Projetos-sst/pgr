import postgres from "postgres";

import { adminClient, applyMigrations, withOrgTx } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";
import { runIsolationSuite } from "../_helpers/isolation-suite";

runIsolationSuite({
  table: "companies",
  seededCountA: 1,
  crossTenantInsertSql:
    "insert into public.companies (org_id, razao_social) values ('org_b','Hijack Ltda')",
});

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

(shouldRun ? describe : describe.skip)(
  "companies — uq_companies_org_id_cnpj (mesmo CNPJ entre orgs vs. no mesmo)",
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

    it("mesmo CNPJ de A em outra org (B) é aceito", async () => {
      await expect(
        withOrgTx(
          runtime,
          "org_b",
          (tx) =>
            tx`insert into public.companies (org_id, cnpj, razao_social) values ('org_b','11111111000111','Mesmo CNPJ')`,
        ),
      ).resolves.toBeDefined();
    });

    it("CNPJ duplicado no mesmo escritório é bloqueado", async () => {
      await expect(
        withOrgTx(
          runtime,
          "org_a",
          (tx) =>
            tx`insert into public.companies (org_id, cnpj, razao_social) values ('org_a','11111111000111','Duplicado')`,
        ),
      ).rejects.toThrow();
    });
  },
);
