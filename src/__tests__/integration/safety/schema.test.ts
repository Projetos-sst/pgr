import {
  adminClient,
  appRuntimeClient,
  applyMigrations,
  withOrgTx,
} from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const shouldRun =
  !!process.env.INTEGRATION_DATABASE_URL && !!process.env.INTEGRATION_APP_RUNTIME_URL;

const FASE06_TABLES = [
  "service_orders",
  "service_order_items",
  "accidents",
  "action_plans",
  "risk_audits",
] as const;

(shouldRun ? describe : describe.skip)(
  "US1 — Fase 06: schema, enums, constraints, RLS e reconciliação (0024)",
  () => {
    let admin: ReturnType<typeof adminClient>;
    let runtime: ReturnType<typeof appRuntimeClient>;

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
      await seedPgrBase(admin);
    });

    it("as 5 tabelas novas têm RLS habilitada", async () => {
      const rows = await admin<{ relname: string }[]>`
        select relname from pg_class
        where relname = any(${FASE06_TABLES as unknown as string[]}) and relrowsecurity`;
      expect(rows.map((r) => r.relname).sort()).toEqual([...FASE06_TABLES].sort());
    });

    it("cada tabela tem policy FOR ALL para app_runtime", async () => {
      for (const t of FASE06_TABLES) {
        const [p] = await admin<{ polname: string; polcmd: string }[]>`
          select p.polname, p.polcmd from pg_policy p
          join pg_class c on c.oid = p.polrelid where c.relname = ${t}`;
        expect(p).toBeTruthy();
        expect(p.polcmd).toBe("*"); // '*' = ALL
      }
    });

    it("enums fechados existem com exatamente os valores aprovados", async () => {
      const values = async (typname: string) =>
        (
          await admin<{ enumlabel: string }[]>`
            select e.enumlabel from pg_type t
            join pg_enum e on e.enumtypid = t.oid
            where t.typname = ${typname} order by e.enumsortorder`
        ).map((r) => r.enumlabel);

      expect(await values("service_order_status")).toEqual([
        "open",
        "in_progress",
        "completed",
        "cancelled",
      ]);
      expect(await values("accident_type")).toEqual([
        "typical",
        "commute",
        "occupational_disease",
      ]);
      expect(await values("accident_category")).toEqual([
        "with_leave",
        "without_leave",
        "fatal",
      ]);
      expect(await values("accident_severity")).toEqual([
        "minor",
        "moderate",
        "severe",
        "fatal",
      ]);
      expect(await values("accident_status")).toEqual([
        "registered",
        "awaiting_planning",
        "awaiting_completion",
        "completed",
        "cancelled",
      ]);
      expect(await values("action_plan_status")).toEqual([
        "planned",
        "in_progress",
        "completed",
        "cancelled",
      ]);
      expect(await values("risk_audit_status")).toEqual([
        "awaiting_analysis",
        "planning_actions",
        "completed",
      ]);
    });

    it("origin_type (planos/auditorias) e source_type (itens) são TEXT, não enum", async () => {
      const rows = await admin<{ data_type: string }[]>`
        select data_type from information_schema.columns
        where table_schema = 'public' and (
          (table_name in ('action_plans','risk_audits') and column_name = 'origin_type') or
          (table_name = 'service_order_items' and column_name = 'source_type'))`;
      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r.data_type === "text")).toBe(true);
    });

    it("UNIQUE(org_id, number) da OS e UNIQUE parcial da auditoria ativa existem", async () => {
      const [soNum] = await admin<{ indexdef: string }[]>`
        select indexdef from pg_indexes where indexname = 'uq_service_orders_org_id_number'`;
      expect(soNum.indexdef).toMatch(/UNIQUE/);

      const [audit] = await admin<{ indexdef: string }[]>`
        select indexdef from pg_indexes where indexname = 'uq_risk_audits_active_origin'`;
      expect(audit.indexdef).toMatch(/UNIQUE/);
      expect(audit.indexdef).toMatch(/status <> 'completed'/i);
    });

    it("CHECK de priority (1..3) existe em action_plans", async () => {
      const [c] = await admin<{ ok: number }[]>`
        select 1 as ok from pg_constraint where conname = 'action_plans_priority_check'`;
      expect(c?.ok).toBe(1);
    });

    it("reconciliação: compat prelude deixou billing + is_master presentes", async () => {
      const billing = await admin<{ column_name: string }[]>`
        select column_name from information_schema.columns
        where table_name = 'orgs'
          and column_name in ('stripe_customer_id','stripe_subscription_id','trial_ends_at')`;
      expect(billing).toHaveLength(3);
      const [im] = await admin<{ ok: number }[]>`
        select 1 as ok from information_schema.columns
        where table_name = 'users' and column_name = 'is_master'`;
      expect(im?.ok).toBe(1);
    });

    it("RLS runtime: isolamento tenant A/B em service_orders (backstop real)", async () => {
      await admin`
        insert into public.service_orders (org_id, number, title, opened_at)
        values ('org_a', 1, 'OS A', current_date), ('org_b', 1, 'OS B', current_date)`;

      const a = await withOrgTx(
        runtime,
        "org_a",
        (tx) => tx<{ org_id: string }[]>`select org_id from public.service_orders`,
      );
      expect(a).toHaveLength(1);
      expect(a.every((r) => r.org_id === "org_a")).toBe(true);

      const bare = await runtime<
        { org_id: string }[]
      >`select org_id from public.service_orders`;
      expect(bare).toHaveLength(0);

      await expect(
        withOrgTx(runtime, "org_a", (tx) =>
          tx.unsafe(
            `insert into public.service_orders (org_id, number, title, opened_at) values ('org_b', 2, 'hijack', current_date)`,
          ),
        ),
      ).rejects.toThrow();
    });
  },
);
