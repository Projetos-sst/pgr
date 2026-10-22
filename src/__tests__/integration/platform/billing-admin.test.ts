import type postgres from "postgres";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import { createBillingOffer } from "@/shared/server/platform/billing-catalog-core";
import { startCommercialCheckout } from "@/shared/server/platform/billing-checkout-core";
import {
  getAdminCommercialSubscriptions,
  getAdminCommercialSubscription,
  reconcileAdminCommercialSubscription,
} from "@/shared/server/platform/billing-admin-core";
import { simulateProviderEvent } from "@/shared/db/repositories/billing/provider";
const owner = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free" as const,
};
(process.env.INTEGRATION_APP_RUNTIME_URL ? describe : describe.skip)(
  "administrative billing permission and filters",
  () => {
    let admin: ReturnType<typeof postgres>;
    beforeAll(async () => {
      process.env.APP_ENV = "test";
      process.env.BILLING_MODE = "mock";
      process.env.BILLING_MOCK_ENABLED = "true";
      process.env.BILLING_MOCK_WEBHOOK_SECRET =
        "synthetic-admin-secret-at-least-32-characters";
      admin = adminClient();
      await applyMigrations(admin);
    });
    beforeEach(async () => {
      delete process.env.BILLING_ADMIN_USER_IDS;
      await seedPgrBase(admin);
      await admin`insert into users(id,email) values('owner','billing-admin@example.invalid') on conflict do nothing`;
      await admin`insert into org_memberships(org_id,user_id,role) values('org_a','owner','owner') on conflict(org_id,user_id) do update set role=excluded.role`;
    });
    afterAll(async () => {
      await admin?.end({ timeout: 5 });
    });
    async function checkout() {
      const price = await createBillingOffer(owner, {
        code: "admin_test",
        name: "Oferta de teste",
        interval: "one_time",
        items: [{ product: "pgr", label: "PGR", amountMinor: 100 }],
        limits: { companies: null, employees: null },
        policy: {},
        reason: "Teste de administração",
      });
      return startCommercialCheckout(owner, {
        companyId: I.companyA,
        priceId: price.id,
        key: "admin-checkout-001",
      });
    }
    it("requires a separate explicit permission, refuses collaborator and default empty configuration", async () => {
      await expect(getAdminCommercialSubscriptions(owner)).rejects.toThrow();
      process.env.BILLING_ADMIN_USER_IDS = "owner";
      await expect(
        getAdminCommercialSubscriptions({ ...owner, role: "collaborator" }),
      ).rejects.toThrow();
      expect((await getAdminCommercialSubscriptions(owner)).rows).toHaveLength(0);
    });
    it("filters in SQL, paginates and does not expose raw provider payloads", async () => {
      process.env.BILLING_ADMIN_USER_IDS = "owner";
      const order = await checkout();
      await admin`insert into billing_contracts(org_id,customer_id,offer_id,snapshot,status,provider_subscription_id,created_by) select org_id,customer_id,offer_id,snapshot,status,'admin-copy-'||n,created_by from billing_contracts cross join generate_series(1,20) n where id=${order.contractId}`;
      const one = await getAdminCommercialSubscriptions(owner, {
        companyId: I.companyA,
        plan: "admin_test",
        product: "pgr",
        status: "pending_payment",
        from: "2020-01-01T00:00:00Z",
        to: "2099-01-01T00:00:00Z",
      });
      expect(one.rows).toHaveLength(20);
      expect(one.hasMore).toBe(true);
      expect(
        (await getAdminCommercialSubscriptions(owner, { page: 2 })).rows,
      ).toHaveLength(1);
      expect(
        (await getAdminCommercialSubscriptions(owner, { product: "medicine" })).rows,
      ).toHaveLength(0);
      expect(
        (await getAdminCommercialSubscriptions(owner, { search: "%" })).rows,
      ).toHaveLength(0);
      expect(JSON.stringify(one)).not.toContain("provider_subscription_id");
      await expect(
        getAdminCommercialSubscriptions(owner, {
          from: "2099-01-01T00:00:00Z",
          to: "2020-01-01T00:00:00Z",
        }),
      ).rejects.toThrow();
    });
    it("reconciles a missed event without creating another charge and audits the actor/reason", async () => {
      process.env.BILLING_ADMIN_USER_IDS = "owner";
      const order = await checkout();
      await simulateProviderEvent(owner, order.contractId, "success");
      expect(
        (await getAdminCommercialSubscription(owner, order.contractId)).synchronization
          .inSync,
      ).toBe(false);
      await reconcileAdminCommercialSubscription(owner, {
        contractId: order.contractId,
        reason: "Conferência administrativa",
      });
      await reconcileAdminCommercialSubscription(owner, {
        contractId: order.contractId,
        reason: "Conferência administrativa repetida",
      });
      const detail = await getAdminCommercialSubscription(owner, order.contractId);
      expect(detail.contract.status).toBe("active");
      expect(detail.synchronization.inSync).toBe(true);
      expect(
        detail.history.some(
          (x) => x.actor === "owner" && x.reason === "Conferência administrativa",
        ),
      ).toBe(true);
      expect(await admin`select * from billing_invoices`).toHaveLength(1);
      expect(JSON.stringify(detail.events)).not.toContain("payload");
      await expect(
        getAdminCommercialSubscription({ ...owner, tenantId: "org_b" }, order.contractId),
      ).rejects.toThrow();
    });
  },
);
