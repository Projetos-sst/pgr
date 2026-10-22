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
  getCommercialSubscriptions,
} from "@/shared/server/platform/billing-subscriptions-core";
import {
  previewCommercialChange,
  confirmCommercialChange,
  cancelCommercialSubscription,
  resumeCommercialSubscription,
} from "@/shared/server/platform/billing-management-core";
import type { BillingOfferInput } from "@/shared/domains/billing/contracts";
const owner = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free" as const,
};
const offer = {
  code: "management-test",
  name: "PGR fictício",
  interval: "month",
  items: [{ product: "pgr", label: "PGR", amountMinor: 10000 }],
  limits: { companies: null, employees: null },
  policy: {},
  reason: "Cadastro sintético",
};
(process.env.INTEGRATION_APP_RUNTIME_URL ? describe : describe.skip)(
  "subscription quotes, cancellation and resumption",
  () => {
    let admin: ReturnType<typeof postgres>;
    beforeAll(async () => {
      process.env.APP_ENV = "test";
      process.env.BILLING_MODE = "mock";
      process.env.BILLING_MOCK_ENABLED = "true";
      process.env.BILLING_MOCK_WEBHOOK_SECRET =
        "synthetic-management-secret-at-least-32-characters";
      admin = adminClient();
      await applyMigrations(admin);
    });
    beforeEach(async () => {
      await seedPgrBase(admin);
      await admin`insert into users (id,email) values ('owner','management@example.invalid') on conflict do nothing`;
      await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner') on conflict (org_id,user_id) do update set role='owner'`;
    });
    afterAll(async () => {
      await admin?.end({ timeout: 5 });
    });
    async function active(policy: Partial<BillingOfferInput["policy"]> = {}) {
      const price = await createBillingOffer(owner, { ...offer, policy });
      const c = await startCommercialCheckout(owner, {
        companyId: I.companyA,
        priceId: price.id,
        key: "management-checkout-01",
      });
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "success",
      });
      return c;
    }
    async function next(policy: Partial<BillingOfferInput["policy"]> = {}) {
      return createBillingOffer(owner, {
        ...offer,
        code: "next-management",
        items: [
          ...offer.items,
          { product: "medicine", label: "Medicina", amountMinor: 2500 },
        ],
        policy,
      });
    }
    it("requires an unexpired server quote, does not grant by confirmation and applies immediate change only after payment", async () => {
      const c = await active(),
        price = await next({ changeTiming: "immediate" });
      const quote = await previewCommercialChange(owner, {
        contractId: c.contractId,
        priceId: price.id,
      });
      expect(quote.amountMinor).toBe(12500);
      await confirmCommercialChange(owner, {
        quoteId: quote.id,
        reason: "Confirmação explícita",
      });
      await confirmCommercialChange(owner, {
        quoteId: quote.id,
        reason: "Repetição idempotente",
      });
      expect(
        (await getCommercialSubscriptions(owner)).contracts[0].snapshot.items,
      ).toHaveLength(1);
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "success",
      });
      expect(
        (await getCommercialSubscriptions(owner)).contracts[0].snapshot.items,
      ).toHaveLength(2);
      expect(
        await admin`select * from billing_audit where action='change.confirmed'`,
      ).toHaveLength(1);
    });
    it("refuses stale prices, expired quotes, injected amounts and concurrent quote confirmations", async () => {
      const c = await active(),
        price = await next();
      await createBillingOffer(owner, {
        ...offer,
        code: "next-management",
        items: [{ product: "medicine", label: "Medicina", amountMinor: 7777 }],
      });
      await expect(
        previewCommercialChange(owner, { contractId: c.contractId, priceId: price.id }),
      ).rejects.toThrow();
      const current = await next();
      const one = await previewCommercialChange(owner, {
        contractId: c.contractId,
        priceId: current.id,
      });
      const two = await previewCommercialChange(owner, {
        contractId: c.contractId,
        priceId: current.id,
      });
      await expect(
        confirmCommercialChange(owner, {
          quoteId: one.id,
          reason: "Não confiar no cliente",
          amountMinor: 1,
        }),
      ).rejects.toThrow();
      await admin`update billing_change_quotes set expires_at=now()-interval '1 second' where id=${one.id}`;
      await expect(
        confirmCommercialChange(owner, { quoteId: one.id, reason: "Prévia expirada" }),
      ).rejects.toThrow();
      const three = await previewCommercialChange(owner, {
        contractId: c.contractId,
        priceId: current.id,
      });
      const results = await Promise.allSettled([
        confirmCommercialChange(owner, {
          quoteId: two.id,
          reason: "Primeira confirmação",
        }),
        confirmCommercialChange(owner, {
          quoteId: three.id,
          reason: "Segunda confirmação",
        }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    });
    it("does not bring forward a period-end change when a future renewal is delivered early", async () => {
      const c = await active(),
        price = await next();
      const quote = await previewCommercialChange(owner, {
        contractId: c.contractId,
        priceId: price.id,
      });
      await confirmCommercialChange(owner, {
        quoteId: quote.id,
        reason: "No fim do período",
      });
      await expect(
        simulateCommercialPayment(owner, {
          contractId: c.contractId,
          scenario: "renewal",
        }),
      ).rejects.toThrow();
      expect(
        (await getCommercialSubscriptions(owner)).contracts[0].snapshot.items,
      ).toHaveLength(1);
      const effective = new Date(Date.now() - 1000);
      await admin.begin(async (tx) => {
        await tx`update billing_contracts set period_end=${effective} where id=${c.contractId}`;
        await tx`update billing_change_quotes set effective_at=${effective} where id=${quote.id}`;
      });
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "renewal",
      });
      expect(
        (await getCommercialSubscriptions(owner)).contracts[0].snapshot.items,
      ).toHaveLength(2);
    });
    it("preserves access during scheduled cancellation and makes cancel/resume idempotent", async () => {
      const c = await active();
      await cancelCommercialSubscription(owner, {
        contractId: c.contractId,
        reason: "Cancelamento agendado",
      });
      await cancelCommercialSubscription(owner, {
        contractId: c.contractId,
        reason: "Repetição do cancelamento",
      });
      expect((await getCommercialSubscriptions(owner)).contracts[0]).toMatchObject({
        access: true,
        cancelAtPeriodEnd: true,
      });
      await resumeCommercialSubscription(owner, {
        contractId: c.contractId,
        reason: "Retomada explícita",
      });
      await resumeCommercialSubscription(owner, {
        contractId: c.contractId,
        reason: "Repetição da retomada",
      });
      expect((await getCommercialSubscriptions(owner)).contracts[0]).toMatchObject({
        access: true,
        cancelAtPeriodEnd: false,
      });
    });
    it("does not reactivate terminal cancellation through a late payment event or allow an expired resume", async () => {
      const c = await active({ cancellationTiming: "immediate" });
      await cancelCommercialSubscription(owner, {
        contractId: c.contractId,
        reason: "Encerramento imediato",
      });
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "recovery",
      });
      expect((await getCommercialSubscriptions(owner)).contracts[0]).toMatchObject({
        status: "canceled",
        access: false,
      });
      await expect(
        resumeCommercialSubscription(owner, {
          contractId: c.contractId,
          reason: "Retomada indevida",
        }),
      ).rejects.toThrow();
    });
    it("closes an unpaid attempt before a new checkout so late recovery cannot create two active subscriptions", async () => {
      const price = await createBillingOffer(owner, offer),
        one = await startCommercialCheckout(owner, {
          companyId: I.companyA,
          priceId: price.id,
          key: "old-unpaid-checkout",
        });
      await simulateCommercialPayment(owner, {
        contractId: one.contractId,
        scenario: "refused",
      });
      const two = await startCommercialCheckout(owner, {
        companyId: I.companyA,
        priceId: price.id,
        key: "new-checkout-attempt",
      });
      await simulateCommercialPayment(owner, {
        contractId: one.contractId,
        scenario: "recovery",
      });
      const rows = (await getCommercialSubscriptions(owner)).contracts;
      expect(rows.find((c) => c.id === one.contractId)).toMatchObject({
        status: "canceled",
        access: false,
      });
      expect(rows.find((c) => c.id === two.contractId)).toMatchObject({
        status: "pending_payment",
        access: false,
      });
    });
    it("cancels a pending checkout without activating it, while preserving unrelated manual company permissions", async () => {
      const price = await createBillingOffer(owner, offer),
        c = await startCommercialCheckout(owner, {
          companyId: I.companyA,
          priceId: price.id,
          key: "pending-management-01",
        });
      const previous = await admin`select * from company_modules order by id`;
      await cancelCommercialSubscription(owner, {
        contractId: c.contractId,
        reason: "Abandonar checkout pendente",
      });
      expect((await getCommercialSubscriptions(owner)).contracts[0]).toMatchObject({
        status: "canceled",
        access: false,
      });
      expect(await admin`select * from company_modules order by id`).toEqual(previous);
      await expect(
        previewCommercialChange(
          { ...owner, role: "collaborator" },
          { contractId: c.contractId, priceId: price.id },
        ),
      ).rejects.toThrow();
    });
  },
);
