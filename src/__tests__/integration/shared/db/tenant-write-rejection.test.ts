import postgres from "postgres";

import { adminClient, applyMigrations, withOrgTx } from "../../_helpers/db";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

(shouldRun ? describe : describe.skip)(
  "US7 — rejeição de escrita cross-tenant (WITH CHECK)",
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
      await admin.unsafe("truncate table public.tenant_probe restart identity cascade;");
      await admin.unsafe(
        `insert into public.tenant_probe (organization_id, label) values ('org_a','a1');`,
      );
    });

    it("com tenant A fixado, INSERT com organization_id = B é rejeitado (FR-015)", async () => {
      await expect(
        withOrgTx(
          runtime,
          "org_a",
          (tx) =>
            tx`insert into public.tenant_probe (organization_id, label) values ('org_b','x')`,
        ),
      ).rejects.toThrow();
    });

    it("com tenant A fixado, UPDATE movendo a linha para B é rejeitado (FR-015)", async () => {
      await expect(
        withOrgTx(
          runtime,
          "org_a",
          (tx) =>
            tx`update public.tenant_probe set organization_id = 'org_b' where organization_id = 'org_a'`,
        ),
      ).rejects.toThrow();
    });

    it("com tenant A fixado, INSERT com organization_id = A é aceito", async () => {
      const inserted = await withOrgTx(
        runtime,
        "org_a",
        (tx) =>
          tx`insert into public.tenant_probe (organization_id, label) values ('org_a','a2') returning organization_id`,
      );
      expect(inserted).toHaveLength(1);
    });
  },
);
