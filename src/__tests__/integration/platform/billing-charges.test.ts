import type postgres from "postgres";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import { createBillingOffer } from "@/shared/server/platform/billing-catalog-core";
import { startCommercialCheckout } from "@/shared/server/platform/billing-checkout-core";
import { simulateCommercialPayment } from "@/shared/server/platform/billing-subscriptions-core";
import { getCommercialCharges } from "@/shared/server/platform/billing-charges-core";
const owner = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free" as const,
};
const base = {
  code: "charges-test",
  name: "Oferta fictícia",
  interval: "month",
  limits: { companies: null, employees: null },
  policy: {},
  reason: "Cadastro sintético",
};
const pgr = { product: "pgr", label: "PGR fictício", amountMinor: 10000 },
  medicine = { product: "medicine", label: "Medicina fictícia", amountMinor: 2500 };
(process.env.INTEGRATION_APP_RUNTIME_URL ? describe : describe.skip)(
  "independent and combined service charges",
  () => {
    let admin: ReturnType<typeof postgres>;
    beforeAll(async () => {
      process.env.APP_ENV = "test";
      process.env.BILLING_MODE = "mock";
      process.env.BILLING_MOCK_ENABLED = "true";
      process.env.BILLING_MOCK_WEBHOOK_SECRET =
        "synthetic-charges-secret-at-least-32-characters";
      admin = adminClient();
      await applyMigrations(admin);
    });
    beforeEach(async () => {
      await seedPgrBase(admin);
      await admin`insert into users (id,email) values ('owner','charges@example.invalid') on conflict do nothing`;
      await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner') on conflict (org_id,user_id) do update set role='owner'`;
    });
    afterAll(async () => {
      await admin?.end({ timeout: 5 });
    });
    it.each([
      { items: [pgr], expected: 10000 },
      { items: [medicine], expected: 2500 },
      { items: [pgr, medicine], expected: 12500 },
    ])(
      "preserves purchased item prices and their original breakdown: %j",
      async ({ items, expected }) => {
        const price = await createBillingOffer(owner, { ...base, items });
        const order = await startCommercialCheckout(owner, {
          companyId: I.companyA,
          priceId: price.id,
          key: "charges-checkout-01",
        });
        await simulateCommercialPayment(owner, {
          contractId: order.contractId,
          scenario: "success",
        });
        await createBillingOffer(owner, {
          ...base,
          items: [{ ...pgr, amountMinor: 99999 }],
        });
        const result = await getCommercialCharges(owner, { companyId: I.companyA });
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].items).toEqual(items);
        expect(result.rows[0].amountMinor).toBe(expected);
        expect(result.rows[0]).not.toHaveProperty("providerInvoiceId");
        expect(result.rows[0]).not.toHaveProperty("snapshot");
      },
    );
    it("restricts queries to authenticated owner and validated company/pagination filters", async () => {
      await expect(
        getCommercialCharges({ ...owner, role: "collaborator" }),
      ).rejects.toThrow();
      await expect(getCommercialCharges(owner, { page: 0 })).rejects.toThrow();
      expect(
        (await getCommercialCharges(owner, { companyId: I.companyB })).rows,
      ).toHaveLength(0);
    });
  },
);
