import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn().mockResolvedValue({
    tenantId: "org_a",
    userId: "owner",
    role: "owner",
    plan: "free",
  }),
}));
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import { createBillingOffer } from "@/shared/server/platform/billing-catalog-core";
import { startCommercialCheckout } from "@/shared/server/platform/billing-checkout-core";
import { POST } from "@/app/api/billing/checkout-sessions/route";
const owner = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free" as const,
};
const offer = {
  code: "checkout-test",
  name: "Oferta fictícia",
  interval: "month",
  items: [{ product: "medicine", label: "Medicina", amountMinor: 12500 }],
  limits: { companies: null, employees: null },
  policy: {},
  reason: "Cadastro sintético",
};
(process.env.INTEGRATION_APP_RUNTIME_URL ? describe : describe.skip)(
  "commercial checkout",
  () => {
    let admin: ReturnType<typeof postgres>;
    beforeAll(async () => {
      process.env.APP_ENV = "test";
      process.env.BILLING_MODE = "mock";
      process.env.BILLING_MOCK_ENABLED = "true";
      process.env.BILLING_MOCK_WEBHOOK_SECRET =
        "synthetic-checkout-secret-with-32-characters";
      admin = adminClient();
      await applyMigrations(admin);
    });
    beforeEach(async () => {
      delete process.env.BILLING_MOCK_FAIL_REQUESTS;
      await seedPgrBase(admin);
      await admin`insert into users (id,email) values ('owner','checkout@example.invalid') on conflict do nothing`;
      await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner') on conflict (org_id,user_id) do update set role='owner'`;
    });
    afterAll(async () => {
      await admin?.end({ timeout: 5 });
    });
    it("resolves price on server, persists once under concurrency, does not trust return URLs or grant access", async () => {
      const price = await createBillingOffer(owner, offer),
        input = {
          companyId: I.companyA,
          priceId: price.id,
          key: "checkout-concurrent-01",
        };
      const [one, two] = await Promise.all([
        startCommercialCheckout(owner, input),
        startCommercialCheckout(owner, input),
      ]);
      expect(two).toEqual(one);
      expect(one.checkoutUrl.startsWith("/configuracoes/assinatura/simulacao?")).toBe(
        true,
      );
      expect(await admin`select * from billing_contracts`).toHaveLength(1);
      expect(await admin`select * from billing_customers`).toHaveLength(1);
      expect(await admin`select * from billing_entitlements`).toHaveLength(0);
      expect(
        (await admin`select snapshot from billing_contracts`)[0].snapshot.items,
      ).toEqual(offer.items);
      await expect(
        startCommercialCheckout(owner, {
          ...input,
          amountMinor: 1,
          successUrl: "https://example.invalid",
        }),
      ).rejects.toThrow();
      await expect(
        startCommercialCheckout(owner, { ...input, companyId: I.companyB }),
      ).rejects.toThrow();
    });
    it("maps missing idempotency headers to validation and refuses forged card data", async () => {
      const price = await createBillingOffer(owner, offer),
        body = { companyId: I.companyA, priceId: price.id };
      const req = (input: unknown, key?: string) =>
        new NextRequest("http://localhost/api/billing/checkout-sessions", {
          method: "POST",
          headers: key ? { "Idempotency-Key": key } : {},
          body: JSON.stringify(input),
        });
      expect((await POST(req(body))).status).toBe(422);
      expect(
        (await POST(req({ ...body, cvv: "123" }, "checkout-rest-0001"))).status,
      ).toBe(422);
      expect((await POST(req(body, "checkout-rest-0001"))).status).toBe(201);
    });
    it("retries safely after a simulated provider outage without creating abandoned orders", async () => {
      const price = await createBillingOffer(owner, offer),
        input = { companyId: I.companyA, priceId: price.id, key: "provider-outage-01" };
      process.env.BILLING_MOCK_FAIL_REQUESTS = "true";
      await expect(startCommercialCheckout(owner, input)).rejects.toMatchObject({
        code: "BILLING_UNAVAILABLE",
      });
      expect(await admin`select * from billing_contracts`).toHaveLength(0);
      delete process.env.BILLING_MOCK_FAIL_REQUESTS;
      await expect(startCommercialCheckout(owner, input)).resolves.toHaveProperty(
        "contractId",
      );
    });
  },
);
