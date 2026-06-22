import postgres from "postgres";

import { adminClient, applyMigrations, withOrgTx } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";
import { runIsolationSuite } from "../_helpers/isolation-suite";
import { PGR_IDS } from "../_helpers/pgr-seed";

runIsolationSuite({
  table: "employees",
  seededCountA: 1,
  crossTenantInsertSql: `insert into public.employees (org_id, company_id, full_name, cpf) values ('org_b','${PGR_IDS.companyB}','Hijack','55566677788')`,
});

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

(shouldRun ? describe : describe.skip)(
  "employees — uq_employees_org_cpf (mesmo CPF entre orgs vs. no mesmo)",
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

    it("mesmo CPF de A aceito em outra org (B)", async () => {
      await expect(
        withOrgTx(
          runtime,
          "org_b",
          (tx) =>
            tx`insert into public.employees (org_id, company_id, full_name, cpf) values ('org_b', ${PGR_IDS.companyB}, 'Mesmo CPF', '12345678901')`,
        ),
      ).resolves.toBeDefined();
    });

    it("CPF duplicado no mesmo escritório é bloqueado", async () => {
      await expect(
        withOrgTx(
          runtime,
          "org_a",
          (tx) =>
            tx`insert into public.employees (org_id, company_id, full_name, cpf) values ('org_a', ${PGR_IDS.companyA}, 'Duplicado', '12345678901')`,
        ),
      ).rejects.toThrow();
    });
  },
);
