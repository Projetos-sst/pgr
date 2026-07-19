import postgres from "postgres";

import {
  adminClient,
  appRuntimeClient,
  applyMigrations,
  truncateAll,
  withOrgTx,
} from "../_helpers/db";

// Admin global (#89): a área /admin-global lê o consumo de IA por organização
// (cross-tenant) e o rate limiting deriva a cota do mês corrente. Esta suíte cobre
// o backstop de banco de `ai_usage_events`: isolamento RLS por tenant (app_runtime),
// rejeição de escrita cross-tenant (WITH CHECK) e a agregação cross-tenant que
// alimenta o painel de superadmin.
const shouldRun = !!process.env.INTEGRATION_DATABASE_URL;

(shouldRun ? describe : describe.skip)(
  "ai_usage_events — isolamento + agregação (#89)",
  () => {
    let admin: ReturnType<typeof postgres>;
    let runtime: ReturnType<typeof postgres>;

    beforeAll(async () => {
      admin = adminClient();
      await applyMigrations(admin);
      runtime = appRuntimeClient();
    });

    afterAll(async () => {
      await runtime.end({ timeout: 5 });
      await admin.end({ timeout: 5 });
    });

    beforeEach(async () => {
      // truncateAll cascata p/ ai_usage_events (FK org_id → orgs ON DELETE cascade).
      await truncateAll(admin);
      await admin`insert into public.orgs (id, name) values ('org_a','Org A'), ('org_b','Org B')`;
      await admin`
      insert into public.ai_usage_events (org_id, kind) values
        ('org_a','risk_suggestion'),
        ('org_a','risk_suggestion'),
        ('org_b','risk_suggestion')`;
    });

    it("RLS: tenant fixado (org_a) enxerga só as próprias linhas", async () => {
      const rows = await withOrgTx(
        runtime,
        "org_a",
        (tx) => tx<{ org_id: string }[]>`select org_id from public.ai_usage_events`,
      );
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.org_id === "org_a")).toBe(true);
    });

    it("RLS: query bare (sem tenant) não enxerga uso de nenhum tenant", async () => {
      const bare = await runtime<{ id: string }[]>`select id from public.ai_usage_events`;
      expect(bare).toHaveLength(0);
    });

    it("WITH CHECK: gravar evento marcado p/ outro tenant é rejeitado pelo banco", async () => {
      await expect(
        withOrgTx(
          runtime,
          "org_a",
          (tx) =>
            tx`insert into public.ai_usage_events (org_id, kind) values ('org_b','risk_suggestion')`,
        ),
      ).rejects.toThrow();
    });

    it("agregação cross-tenant (leitura de superadmin) conta por organização", async () => {
      // Espelha a intenção de adminRepo.aiUsageByOrg (service client bypassa RLS):
      // a leitura administrativa enxerga todos os tenants e agrupa por org.
      const rows = await admin<{ org_id: string; count: number }[]>`
      select org_id, count(*)::int as count
      from public.ai_usage_events
      group by org_id
      order by org_id`;
      expect(rows).toEqual([
        { org_id: "org_a", count: 2 },
        { org_id: "org_b", count: 1 },
      ]);
    });
  },
);
