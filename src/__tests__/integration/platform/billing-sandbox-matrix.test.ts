import type postgres from "postgres";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import { createBillingOffer } from "@/shared/server/platform/billing-catalog-core";
import { startCommercialCheckout } from "@/shared/server/platform/billing-checkout-core";
import {
  simulateCommercialPayment,
  reconcileCommercialSubscription,
  getCommercialSubscriptions,
} from "@/shared/server/platform/billing-subscriptions-core";
import { simulateProviderEvent } from "@/shared/db/repositories/billing/provider";
const owner = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free" as const,
};
(process.env.INTEGRATION_APP_RUNTIME_URL ? describe : describe.skip)(
  "sandbox acceptance matrix",
  () => {
    let admin: ReturnType<typeof postgres>;
    beforeAll(async () => {
      process.env.APP_ENV = "test";
      process.env.BILLING_MODE = "mock";
      process.env.BILLING_MOCK_ENABLED = "true";
      process.env.BILLING_MOCK_WEBHOOK_SECRET =
        "synthetic-matrix-secret-at-least-32-characters";
      admin = adminClient();
      await applyMigrations(admin);
    });
    beforeEach(async () => {
      delete process.env.BILLING_MOCK_FAIL_REQUESTS;
      await seedPgrBase(admin);
      await admin`insert into users(id,email) values('owner','billing-matrix@example.invalid') on conflict do nothing`;
      await admin`insert into org_memberships(org_id,user_id,role) values('org_a','owner','owner') on conflict(org_id,user_id) do update set role=excluded.role`;
    });
    afterAll(async () => {
      await admin?.end({ timeout: 5 });
    });
    async function checkout(suspend = false) {
      const p = await createBillingOffer(owner, {
        code: "matrix_test",
        name: "Matriz sintética",
        interval: "month",
        items: [{ product: "pgr", label: "PGR", amountMinor: 10000 }],
        limits: { companies: null, employees: null },
        policy: { pastDueAccess: suspend ? "suspend" : "preserve_until_period_end" },
        reason: "Matriz sandbox",
      });
      return startCommercialCheckout(owner, {
        companyId: I.companyA,
        priceId: p.id,
        key: "matrix-checkout-001",
      });
    }
    it("refuses unsupported one-off Pro even at the generic checkout endpoint", async () => {
      const p = await createBillingOffer(owner, {
        code: "unsupported_pro",
        name: "Teste de rejeição",
        interval: "one_time",
        items: [{ product: "pro", label: "Pro", amountMinor: 100 }],
        limits: { companies: null, employees: null },
        policy: {},
        reason: "Conferir rejeição",
      });
      await expect(
        startCommercialCheckout(owner, {
          companyId: I.companyA,
          priceId: p.id,
          key: "unsupported-pro-001",
        }),
      ).rejects.toThrow("somente de PGR ou Medicina");
      expect(await admin`select * from billing_contracts`).toHaveLength(0);
    });
    async function state() {
      return (await getCommercialSubscriptions(owner)).contracts[0];
    }
    it.each([
      ["success", "active", true],
      ["requires_action", "requires_action", false],
      ["refused", "unpaid", false],
    ] as const)(
      "initial %s yields %s with access=%s",
      async (scenario, status, access) => {
        const c = await checkout();
        await simulateCommercialPayment(owner, { contractId: c.contractId, scenario });
        expect(await state()).toMatchObject({ status, access });
      },
    );
    it.each([false, true])(
      "applies configured arrears policy, suspend=%s, then recovery",
      async (suspend) => {
        const c = await checkout(suspend);
        await simulateCommercialPayment(owner, {
          contractId: c.contractId,
          scenario: "success",
        });
        await simulateCommercialPayment(owner, {
          contractId: c.contractId,
          scenario: "late",
        });
        expect(await state()).toMatchObject({ status: "past_due", access: !suspend });
        await simulateCommercialPayment(owner, {
          contractId: c.contractId,
          scenario: "recovery",
        });
        expect(await state()).toMatchObject({ status: "active", access: true });
      },
    );
    it("renews, ignores stale and repeated events and keeps a terminal cancellation terminal", async () => {
      const c = await checkout();
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "success",
      });
      const first = await state();
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "renewal",
      });
      expect((await state()).periodEnd!.getTime()).toBeGreaterThan(
        first.periodEnd!.getTime(),
      );
      const count = (await admin`select * from billing_invoices`).length;
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "duplicate",
      });
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "out_of_order",
      });
      expect((await admin`select * from billing_invoices`).length).toBe(count);
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "cancel",
      });
      await expect(
        simulateCommercialPayment(owner, {
          contractId: c.contractId,
          scenario: "recovery",
        }),
      ).rejects.toThrow("O período pago ainda não começou.");
      expect(await state()).toMatchObject({ status: "canceled", access: false });
    });
    it("retains confirmed authority through outage, reconciles after recovery, and refuses another tenant", async () => {
      const c = await checkout();
      await simulateProviderEvent(owner, c.contractId, "success");
      process.env.BILLING_MOCK_FAIL_REQUESTS = "true";
      await expect(
        reconcileCommercialSubscription(owner, {
          contractId: c.contractId,
          reason: "Conferir interrupção",
        }),
      ).rejects.toMatchObject({ status: 503 });
      expect(await state()).toMatchObject({ status: "pending_payment", access: false });
      process.env.BILLING_MOCK_FAIL_REQUESTS = "false";
      await reconcileCommercialSubscription(owner, {
        contractId: c.contractId,
        reason: "Conferir após recuperação",
      });
      expect(await state()).toMatchObject({ status: "active", access: true });
      await expect(
        simulateCommercialPayment(
          { ...owner, tenantId: "org_b" },
          { contractId: c.contractId, scenario: "cancel" },
        ),
      ).rejects.toThrow();
      expect(await state()).toMatchObject({ status: "active", access: true });
    });
    it("applies tenant RLS, append-only grants, composite FKs and hardened helper execution", async () => {
      const tables =
        await admin`select relname,relrowsecurity from pg_class where relname like 'billing_%' and relkind='r'`;
      expect(tables.length).toBe(12);
      expect(tables.every((t) => t.relrowsecurity)).toBe(true);
      const auditPrivileges =
        await admin`select privilege_type from information_schema.role_table_grants where grantee='app_runtime' and table_name='billing_audit'`;
      expect(auditPrivileges.map((p) => p.privilege_type).sort()).toEqual([
        "INSERT",
        "SELECT",
      ]);
      const helpers =
        await admin`select proname,prosecdef,proconfig,coalesce(has_function_privilege('public',p.oid,'EXECUTE'),false) as public_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('billing_tenant_pro_allowed','billing_company_export_allowed','billing_order_service_allowed')`;
      expect(helpers).toHaveLength(3);
      expect(
        helpers.every(
          (h) =>
            h.prosecdef &&
            h.proconfig.includes("search_path=pg_catalog, public") &&
            !h.public_execute,
        ),
      ).toBe(true);
      const fk =
        await admin`select conname from pg_constraint where conrelid='billing_contracts'::regclass and contype='f' and array_length(conkey,1)=2`;
      expect(fk).toHaveLength(2);
    });
  },
);
