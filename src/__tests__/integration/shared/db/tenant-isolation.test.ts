import postgres from "postgres";

import { adminClient, applyMigrations, withOrgTx } from "../../_helpers/db";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

type ProbeRow = { organization_id: string };

(shouldRun ? describe : describe.skip)(
  "US4/US3 — tenant isolation (RLS backstop)",
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
      await admin.unsafe(`
      insert into public.tenant_probe (organization_id, label) values
        ('org_a','a1'), ('org_a','a2'), ('org_b','b1');
    `);
    });

    it("com tenant A fixado, select SEM where retorna só linhas de A (FR-013)", async () => {
      const rows = await withOrgTx(
        runtime,
        "org_a",
        (tx) => tx<ProbeRow[]>`select organization_id from public.tenant_probe`,
      );
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.organization_id === "org_a")).toBe(true);
    });

    it("com tenant B fixado, select SEM where retorna só linhas de B", async () => {
      const rows = await withOrgTx(
        runtime,
        "org_b",
        (tx) => tx<ProbeRow[]>`select organization_id from public.tenant_probe`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].organization_id).toBe("org_b");
    });

    it("sem tenant fixado (query bare), retorna 0 linhas (FR-014/SC-010)", async () => {
      const rows = await runtime<
        ProbeRow[]
      >`select organization_id from public.tenant_probe`;
      expect(rows).toHaveLength(0);
    });

    it("com orgId inexistente/inválido fixado, retorna 0 linhas (FR-018)", async () => {
      const rows = await withOrgTx(
        runtime,
        "org_does_not_exist",
        (tx) => tx<ProbeRow[]>`select organization_id from public.tenant_probe`,
      );
      expect(rows).toHaveLength(0);
    });

    it("após withOrg(A), uma query bare subsequente não vaza o escopo (SC-011)", async () => {
      await withOrgTx(
        runtime,
        "org_a",
        (tx) => tx<ProbeRow[]>`select organization_id from public.tenant_probe`,
      );
      const rows = await runtime<
        ProbeRow[]
      >`select organization_id from public.tenant_probe`;
      expect(rows).toHaveLength(0);
    });
  },
);
