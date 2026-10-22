import type postgres from "postgres";
import { createHmac } from "node:crypto";
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
import { adminClient, applyMigrations, withOrgTx } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import { createBillingOffer } from "@/shared/server/platform/billing-catalog-core";
import { startCommercialCheckout } from "@/shared/server/platform/billing-checkout-core";
import {
  simulateCommercialPayment,
  getCommercialSubscriptions,
  reconcileCommercialSubscription,
  receiveCommercialWebhook,
} from "@/shared/server/platform/billing-subscriptions-core";
import { simulateProviderEvent } from "@/shared/db/repositories/billing/provider";
import { withOrg } from "@/shared/db/with-org";
import { listCompanies } from "@/shared/db/repositories/companies";
import { changeCompanyModule } from "@/shared/server/platform/company-module-core";
import { POST } from "@/app/api/billing/webhooks/provider/route";
const owner = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free" as const,
};
const secret = "synthetic-subscription-secret-at-least-32-characters";
const offer = {
  code: "subscription-test",
  name: "Oferta fictícia PGR",
  interval: "month",
  items: [{ product: "pgr", label: "PGR", amountMinor: 10000 }],
  limits: { companies: null, employees: null },
  policy: {},
  reason: "Cadastro sintético",
};
(process.env.INTEGRATION_APP_RUNTIME_URL ? describe : describe.skip)(
  "commercial subscriptions and operational RLS",
  () => {
    let admin: ReturnType<typeof postgres>, runtime: ReturnType<typeof postgres>;
    beforeAll(async () => {
      process.env.APP_ENV = "test";
      process.env.BILLING_MODE = "mock";
      process.env.BILLING_MOCK_ENABLED = "true";
      process.env.BILLING_MOCK_WEBHOOK_SECRET = secret;
      admin = adminClient();
      await applyMigrations(admin);
      runtime = (await import("postgres")).default(
        process.env.INTEGRATION_APP_RUNTIME_URL!,
        { max: 1, prepare: false },
      );
    });
    beforeEach(async () => {
      delete process.env.BILLING_MOCK_FAIL_REQUESTS;
      await seedPgrBase(admin);
      await admin`insert into users (id,email) values ('owner','subscription@example.invalid') on conflict do nothing`;
      await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner') on conflict (org_id,user_id) do update set role='owner'`;
    });
    afterAll(async () => {
      await runtime?.end({ timeout: 5 });
      await admin?.end({ timeout: 5 });
    });
    async function order() {
      const price = await createBillingOffer(owner, offer);
      return startCommercialCheckout(owner, {
        companyId: I.companyA,
        priceId: price.id,
        key: "subscription-checkout-01",
      });
    }
    it("validates signatures and exact raw body before writes, with bounded authenticated REST payloads", async () => {
      const c = await order();
      const event = await simulateProviderEvent(owner, c.contractId, "success");
      const body = JSON.stringify(event),
        t = Math.floor(Date.now() / 1000),
        signature = `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
      await expect(
        receiveCommercialWebhook(owner, body + " ", signature),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await admin`select * from billing_events`).toHaveLength(0);
      expect(
        (
          await POST(
            new NextRequest("http://localhost/api/billing/webhooks/provider", {
              method: "POST",
              headers: { "billing-signature": signature },
              body,
            }),
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await POST(
            new NextRequest("http://localhost/api/billing/webhooks/provider", {
              method: "POST",
              body: "x".repeat(16385),
            }),
          )
        ).status,
      ).toBe(422);
    });
    it("rejects underpaid invoices and reused invoice periods atomically", async () => {
      const c = await order(),
        event = await simulateProviderEvent(owner, c.contractId, "success");
      const send = (payload: unknown) => {
        const body = JSON.stringify(payload),
          t = Math.floor(Date.now() / 1000);
        return receiveCommercialWebhook(
          owner,
          body,
          `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`,
        );
      };
      await expect(
        send({ ...event, invoice: { ...event.invoice, amountMinor: 1 } }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      expect(await admin`select * from billing_events`).toHaveLength(0);
      expect(await admin`select * from billing_entitlements`).toHaveLength(0);
      await send(event);
      const original = (await admin`select period_end from billing_contracts`)[0]
        .period_end;
      await expect(
        send({
          ...event,
          eventId: "reused-invoice",
          revision: 2,
          periodEnd: new Date(+original + 86400000).toISOString(),
        }),
      ).rejects.toThrow();
      expect(
        (await admin`select period_end from billing_contracts`)[0].period_end,
      ).toEqual(original);
      expect(await admin`select * from billing_invoices`).toHaveLength(1);
    });
    it("deduplicates concurrent events and ignores old revisions without duplicate invoices", async () => {
      const c = await order();
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "success",
      });
      await Promise.all([
        simulateCommercialPayment(owner, {
          contractId: c.contractId,
          scenario: "duplicate",
        }),
        simulateCommercialPayment(owner, {
          contractId: c.contractId,
          scenario: "duplicate",
        }),
      ]);
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "out_of_order",
      });
      expect(await admin`select * from billing_invoices`).toHaveLength(1);
      expect((await getCommercialSubscriptions(owner)).contracts[0].status).toBe(
        "active",
      );
    });
    it("reconciles durable provider state after a missed event and audits retries", async () => {
      const c = await order();
      await simulateProviderEvent(owner, c.contractId, "success");
      expect((await getCommercialSubscriptions(owner)).contracts[0].status).toBe(
        "pending_payment",
      );
      await reconcileCommercialSubscription(owner, {
        contractId: c.contractId,
        reason: "Evento perdido de teste",
      });
      await reconcileCommercialSubscription(owner, {
        contractId: c.contractId,
        reason: "Repetição de teste",
      });
      expect((await getCommercialSubscriptions(owner)).contracts[0].status).toBe(
        "active",
      );
      expect(await admin`select * from billing_invoices`).toHaveLength(1);
      expect(
        await admin`select * from billing_audit where action='provider.reconcile_requested'`,
      ).toHaveLength(2);
    });
    it("enforces purchased company/product in RLS, expires access and preserves independent manual grants", async () => {
      await admin`delete from company_modules where company_id=${I.companyA} and module='pgr'`;
      await admin`insert into companies (id,org_id,razao_social) values ('99999999-9999-4999-8999-999999999999','org_a','Outra empresa')`;
      const original = await admin`select * from company_modules order by id`;
      const c = await order();
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "success",
      });
      expect(
        (await listCompanies("org_a", { module: "pgr" })).rows.map((r) => r.id),
      ).toEqual([I.companyA]);
      expect(
        await withOrg("org_a", (tx) => tx.execute("select id from pgr")),
      ).toHaveLength(1);
      expect(await admin`select * from company_modules order by id`).toEqual(original);
      await admin`update billing_contracts set period_end=now()-interval '1 second' where id=${c.contractId}`;
      expect((await listCompanies("org_a", { module: "pgr" })).rows).toHaveLength(0);
      expect(
        (await listCompanies("org_a", { module: "medicine" })).rows.map((r) => r.id),
      ).toEqual([I.companyA]);
    });
    it("keeps an explicit owner revocation effective during concurrent renewal", async () => {
      await admin`delete from company_modules where company_id=${I.companyA} and module='pgr'`;
      const c = await order();
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "success",
      });
      await Promise.all([
        simulateCommercialPayment(owner, {
          contractId: c.contractId,
          scenario: "renewal",
        }),
        changeCompanyModule(owner, I.companyA, {
          module: "pgr",
          enabled: false,
          reason: "Revogação explícita pelo administrador",
        }),
      ]);
      expect((await listCompanies("org_a", { module: "pgr" })).rows).toHaveLength(0);
      expect(
        (
          await admin`select enabled from company_modules where company_id=${I.companyA} and module='pgr'`
        )[0].enabled,
      ).toBe(false);
    });
    it("denies cross-tenant finance and operational grants even with a forged owner actor", async () => {
      const c = await order();
      await simulateCommercialPayment(owner, {
        contractId: c.contractId,
        scenario: "success",
      });
      expect(
        await withOrgTx(runtime, "org_b", async (tx) => {
          await tx`select set_config('app.current_actor','owner',true)`;
          return tx`select * from billing_contracts`;
        }),
      ).toHaveLength(0);
      expect(
        (
          await withOrgTx(runtime, "org_b", async (tx) => {
            await tx`select set_config('app.billing_simulation','true',true)`;
            return tx`select public.billing_module_allowed('org_a',${I.companyA},'pgr') as allowed`;
          })
        )[0].allowed,
      ).toBe(false);
      await expect(
        simulateCommercialPayment(
          { ...owner, role: "collaborator" },
          { contractId: c.contractId, scenario: "success" },
        ),
      ).rejects.toThrow();
    });
  },
);
