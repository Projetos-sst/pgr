import type postgres from "postgres";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
import { adminClient, applyMigrations, withOrgTx } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import { createBillingOffer } from "@/shared/server/platform/billing-catalog-core";
import { startCommercialCheckout } from "@/shared/server/platform/billing-checkout-core";
import { simulateCommercialPayment } from "@/shared/server/platform/billing-subscriptions-core";
import {
  createCommercialOrder,
  getCommercialOrder,
  requirePurchasedService,
} from "@/shared/server/platform/billing-orders-core";
import { listCompanies } from "@/shared/db/repositories/companies";
const owner = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free" as const,
};
const offer = {
  code: "one-off-test",
  name: "Serviço fictício PGR",
  interval: "one_time",
  items: [{ product: "pgr", label: "PGR avulso fictício", amountMinor: 10000 }],
  limits: { companies: null, employees: null },
  policy: {},
  reason: "Cadastro sintético",
};
(process.env.INTEGRATION_APP_RUNTIME_URL ? describe : describe.skip)(
  "one-off services for subscribers and non-subscribers",
  () => {
    let admin: ReturnType<typeof postgres>, runtime: ReturnType<typeof postgres>;
    beforeAll(async () => {
      process.env.APP_ENV = "test";
      process.env.BILLING_MODE = "mock";
      process.env.BILLING_MOCK_ENABLED = "true";
      process.env.BILLING_MOCK_WEBHOOK_SECRET =
        "synthetic-orders-secret-at-least-32-characters";
      admin = adminClient();
      await applyMigrations(admin);
      runtime = (await import("postgres")).default(
        process.env.INTEGRATION_APP_RUNTIME_URL!,
        { max: 1, prepare: false },
      );
    });
    beforeEach(async () => {
      await seedPgrBase(admin);
      await admin`insert into users (id,email) values ('owner','orders@example.invalid'),('collaborator','collaborator-orders@example.invalid') on conflict do nothing`;
      await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','collaborator','collaborator') on conflict (org_id,user_id) do update set role=excluded.role`;
    });
    afterAll(async () => {
      await runtime?.end({ timeout: 5 });
      await admin?.end({ timeout: 5 });
    });
    async function order() {
      const price = await createBillingOffer(owner, offer);
      return createCommercialOrder(owner, {
        companyId: I.companyA,
        priceId: price.id,
        key: "one-off-checkout-01",
      });
    }
    it.each([false, true])(
      "creates a standalone order with existing subscription=%s, without granting another product or the whole module",
      async (subscribed) => {
        await admin`delete from company_modules where company_id=${I.companyA} and module='pgr'`;
        if (subscribed) {
          const pro = await createBillingOffer(owner, {
            ...offer,
            code: "pro-test",
            interval: "month",
            items: [{ product: "pro", label: "Pro fictício", amountMinor: 5000 }],
          });
          const c = await startCommercialCheckout(owner, {
            companyId: I.companyA,
            priceId: pro.id,
            key: "pro-checkout-01",
          });
          await simulateCommercialPayment(owner, {
            contractId: c.contractId,
            scenario: "success",
          });
        }
        const c = await order();
        const access = { orderId: c.contractId, companyId: I.companyA, product: "pgr" };
        await expect(requirePurchasedService(owner, access)).rejects.toThrow();
        await simulateCommercialPayment(owner, {
          contractId: c.contractId,
          scenario: "success",
        });
        expect((await getCommercialOrder(owner, c.contractId)).availableProducts).toEqual(
          ["pgr"],
        );
        await expect(requirePurchasedService(owner, access)).resolves.toMatchObject({
          financiallyAuthorized: true,
          scope: `order:${c.contractId}`,
        });
        await expect(
          requirePurchasedService(owner, { ...access, product: "medicine" }),
        ).rejects.toThrow();
        expect((await listCompanies("org_a", { module: "pgr" })).rows).toHaveLength(0);
      },
    );
    it("reuses the same request and rejects recurring offers at the standalone endpoint", async () => {
      const price = await createBillingOffer(owner, offer),
        input = { companyId: I.companyA, priceId: price.id, key: "idempotent-order-01" };
      const [one, two] = await Promise.all([
        createCommercialOrder(owner, input),
        createCommercialOrder(owner, input),
      ]);
      expect(two).toEqual(one);
      const recurring = await createBillingOffer(owner, {
        ...offer,
        code: "recurring-test",
        interval: "month",
      });
      await expect(
        createCommercialOrder(owner, {
          ...input,
          priceId: recurring.id,
          key: "invalid-order-01",
        }),
      ).rejects.toThrow();
      expect(await admin`select * from billing_contracts`).toHaveLength(1);
    });
    it("allows operational staff only with current membership and the correct company, but never exposes financial rows", async () => {
      const c = await order();
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "success",
      });
      const collaborator = { ...owner, userId: "collaborator", role: "collaborator" };
      const input = { orderId: c.contractId, companyId: I.companyA, product: "pgr" };
      await expect(requirePurchasedService(collaborator, input)).resolves.toHaveProperty(
        "financiallyAuthorized",
        true,
      );
      await expect(getCommercialOrder(collaborator, c.contractId)).rejects.toThrow();
      await expect(
        requirePurchasedService(collaborator, { ...input, companyId: I.companyB }),
      ).rejects.toThrow();
      await admin`delete from org_memberships where org_id='org_a' and user_id='collaborator'`;
      await expect(requirePurchasedService(collaborator, input)).rejects.toThrow();
    });
    it("refusal and cancellation with repeated events do not release a service", async () => {
      const c = await order();
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "refused",
      });
      expect((await getCommercialOrder(owner, c.contractId)).availableProducts).toEqual(
        [],
      );
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "success",
      });
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "cancel",
      });
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "duplicate",
      });
      await expect(
        requirePurchasedService(owner, {
          orderId: c.contractId,
          companyId: I.companyA,
          product: "pgr",
        }),
      ).rejects.toThrow();
    });
    it("protects historical invoice amounts and items from runtime UPDATE", async () => {
      const c = await order();
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "success",
      });
      await expect(
        withOrgTx(runtime, "org_a", async (tx) => {
          await tx`select set_config('app.current_actor','owner',true)`;
          return tx`update billing_invoices set amount_minor=1 where contract_id=${c.contractId}`;
        }),
      ).rejects.toThrow();
      expect(
        (await admin`select amount_minor from billing_invoices`)[0].amount_minor,
      ).toBe(10000);
    });
  },
);
