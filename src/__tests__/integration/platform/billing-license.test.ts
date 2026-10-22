import type postgres from "postgres";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import { createBillingOffer } from "@/shared/server/platform/billing-catalog-core";
import { startCommercialCheckout } from "@/shared/server/platform/billing-checkout-core";
import { simulateCommercialPayment } from "@/shared/server/platform/billing-subscriptions-core";
import { resolveCommercialPlan } from "@/shared/db/repositories/billing-license";
import { getCompanyModules } from "@/shared/db/repositories/company-modules";
const owner = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free" as const,
};
(process.env.INTEGRATION_APP_RUNTIME_URL ? describe : describe.skip)(
  "commercial Pro additive license",
  () => {
    let admin: ReturnType<typeof postgres>;
    beforeAll(async () => {
      process.env.APP_ENV = "test";
      process.env.BILLING_MODE = "mock";
      process.env.BILLING_MOCK_ENABLED = "true";
      process.env.BILLING_MOCK_WEBHOOK_SECRET =
        "synthetic-license-secret-at-least-32-characters";
      admin = adminClient();
      await applyMigrations(admin);
    });
    beforeEach(async () => {
      process.env.BILLING_MOCK_ENABLED = "true";
      delete process.env.VERCEL_ENV;
      delete process.env.VERCEL_TARGET_ENV;
      await seedPgrBase(admin);
      await admin`insert into users(id,email) values('owner','billing-license@example.invalid') on conflict do nothing`;
      await admin`insert into org_memberships(org_id,user_id,role) values('org_a','owner','owner') on conflict(org_id,user_id) do update set role=excluded.role`;
    });
    afterAll(async () => {
      await admin?.end({ timeout: 5 });
    });
    async function paid(product: "pro" | "medicine" = "pro") {
      const p = await createBillingOffer(owner, {
        code: "license_test",
        name: "Licença teste",
        interval: "month",
        items: [{ product, label: product, amountMinor: 100 }],
        limits: { companies: null, employees: null },
        policy: {},
        reason: "Teste de licença",
      });
      const order = await startCommercialCheckout(owner, {
        companyId: I.companyA,
        priceId: p.id,
        key: "license-checkout-001",
      });
      expect(await resolveCommercialPlan("org_a", "free")).toBe("free");
      await simulateCommercialPayment(owner, {
        contractId: order.contractId,
        scenario: "success",
      });
      return order;
    }
    it("grants Pro from a paid recurring Pro product, isolates tenants and expires without rewriting the original plan", async () => {
      const order = await paid();
      await admin`delete from company_modules where org_id='org_a'`;
      expect(
        (await getCompanyModules("org_a", I.companyA)).every((m) => !m.enabled),
      ).toBe(true);
      expect(await resolveCommercialPlan("org_a", "free")).toBe("pro");
      expect(await resolveCommercialPlan("org_b", "free")).toBe("free");
      await admin`update billing_contracts set period_end=now()-interval '1 second' where id=${order.contractId}`;
      expect(await resolveCommercialPlan("org_a", "free")).toBe("free");
      expect(await resolveCommercialPlan("org_a", "pro")).toBe("pro");
      expect((await admin`select plan from orgs where id='org_a'`)[0].plan).toBe("free");
    });
    it("does not turn a standalone Medicine subscription into Pro", async () => {
      await paid("medicine");
      expect(await resolveCommercialPlan("org_a", "free")).toBe("free");
    });
    it("hard-blocks simulated Pro in production and with flags disabled while retaining legacy Pro", async () => {
      await paid();
      process.env.BILLING_MOCK_ENABLED = "false";
      expect(await resolveCommercialPlan("org_a", "free")).toBe("free");
      expect(await resolveCommercialPlan("org_a", "pro")).toBe("pro");
      process.env.BILLING_MOCK_ENABLED = "true";
      process.env.VERCEL_ENV = "production";
      expect(await resolveCommercialPlan("org_a", "free")).toBe("free");
      delete process.env.VERCEL_ENV;
    });
  },
);
