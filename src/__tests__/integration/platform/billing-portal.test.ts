import type postgres from "postgres";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import {
  createBillingCustomer,
  createBillingOffer,
} from "@/shared/server/platform/billing-catalog-core";
import {
  openCommercialPortal,
  validateCommercialPortal,
  getCommercialPaymentProfile,
  synchronizeMockPaymentProfile,
} from "@/shared/server/platform/billing-portal-core";
import { startCommercialCheckout } from "@/shared/server/platform/billing-checkout-core";
import { getCommercialCharges } from "@/shared/server/platform/billing-charges-core";
const owner = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free" as const,
};
(process.env.INTEGRATION_APP_RUNTIME_URL ? describe : describe.skip)(
  "invoices, masked payment profile and temporary portal",
  () => {
    let admin: ReturnType<typeof postgres>;
    beforeAll(async () => {
      process.env.APP_ENV = "test";
      process.env.BILLING_MODE = "mock";
      process.env.BILLING_MOCK_ENABLED = "true";
      process.env.BILLING_MOCK_WEBHOOK_SECRET =
        "synthetic-portal-secret-at-least-32-characters";
      admin = adminClient();
      await applyMigrations(admin);
    });
    beforeEach(async () => {
      delete process.env.BILLING_MOCK_FAIL_REQUESTS;
      await seedPgrBase(admin);
      await admin`insert into users (id,email) values ('owner','portal@example.invalid'),('owner-two','portal-two@example.invalid') on conflict do nothing`;
      await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','owner-two','owner') on conflict (org_id,user_id) do update set role=excluded.role`;
    });
    afterAll(async () => {
      await admin?.end({ timeout: 5 });
    });
    it("creates one authenticated portal per retry key and binds it to the requesting owner/customer", async () => {
      const customer = await createBillingCustomer(owner, { companyId: I.companyA }),
        input = { customerId: customer.id, key: "portal-session-01" };
      const [one, two] = await Promise.all([
        openCommercialPortal(owner, input),
        openCommercialPortal(owner, input),
      ]);
      expect(two).toEqual(one);
      expect((await validateCommercialPortal(owner, one.sessionId)).companyId).toBe(
        I.companyA,
      );
      await expect(
        validateCommercialPortal({ ...owner, userId: "owner-two" }, one.sessionId),
      ).rejects.toThrow();
      await expect(
        validateCommercialPortal({ ...owner, tenantId: "org_b" }, one.sessionId),
      ).rejects.toThrow();
      expect(
        await admin`select * from billing_operations where kind='portal'`,
      ).toHaveLength(1);
      await synchronizeMockPaymentProfile(owner, {
        sessionId: one.sessionId,
        method: "visa_test_4242",
      });
      await synchronizeMockPaymentProfile(owner, {
        sessionId: one.sessionId,
        method: "visa_test_4242",
      });
      expect(
        (await getCommercialPaymentProfile(owner, customer.id)).paymentMethod,
      ).toMatchObject({ brand: "Visa (teste)", last4: "4242" });
      expect(
        await admin`select * from billing_operations where kind like 'payment_profile:%'`,
      ).toHaveLength(1);
      await expect(
        synchronizeMockPaymentProfile(
          { ...owner, userId: "owner-two" },
          { sessionId: one.sessionId, method: "visa_test_4242" },
        ),
      ).rejects.toThrow();
    });
    it("refuses expired sessions, arbitrary return URLs and raw card fields without storing payment data", async () => {
      const customer = await createBillingCustomer(owner, { companyId: I.companyA }),
        input = { customerId: customer.id, key: "portal-session-01" };
      await expect(
        openCommercialPortal(owner, {
          ...input,
          returnUrl: "https://example.invalid",
          cvv: "123",
        }),
      ).rejects.toThrow();
      const portal = await openCommercialPortal(owner, input);
      await admin`update billing_operations set expires_at=now()-interval '1 second' where id=${portal.sessionId}`;
      await expect(validateCommercialPortal(owner, portal.sessionId)).rejects.toThrow();
      expect(await getCommercialPaymentProfile(owner, customer.id)).toMatchObject({
        paymentMethod: null,
        provider: "mock",
        simulated: true,
      });
      await expect(
        getCommercialPaymentProfile({ ...owner, role: "collaborator" }, customer.id),
      ).rejects.toThrow();
    });
    it("keeps the invoice history readable during a provider outage and paginates beyond 20 rows", async () => {
      const price = await createBillingOffer(owner, {
        code: "portal-test",
        name: "PGR fictício",
        interval: "month",
        items: [{ product: "pgr", label: "PGR", amountMinor: 10000 }],
        limits: { companies: null, employees: null },
        policy: {},
        reason: "Cadastro sintético",
      });
      const c = await startCommercialCheckout(owner, {
        companyId: I.companyA,
        priceId: price.id,
        key: "portal-history-checkout",
      });
      for (let i = 0; i < 21; i++)
        await admin`insert into billing_invoices (org_id,contract_id,event_id,provider_invoice_id,amount_minor,status,items) values ('org_a',${c.contractId},${`event-page-${i}`},${`invoice-page-${i}`},10000,'paid',${admin.json([{ product: "pgr", label: "PGR original", amountMinor: 10000 }])})`;
      process.env.BILLING_MOCK_FAIL_REQUESTS = "true";
      const one = await getCommercialCharges(owner, { page: 1 }),
        two = await getCommercialCharges(owner, { page: 2 });
      expect(one.rows).toHaveLength(20);
      expect(one.hasMore).toBe(true);
      expect(two.rows).toHaveLength(1);
      expect(two.hasMore).toBe(false);
      const customer = await createBillingCustomer(owner, { companyId: I.companyA });
      await expect(
        openCommercialPortal(owner, { customerId: customer.id, key: "portal-outage-01" }),
      ).rejects.toMatchObject({ code: "BILLING_UNAVAILABLE" });
    });
  },
);
