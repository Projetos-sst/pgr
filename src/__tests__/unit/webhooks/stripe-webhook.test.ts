/** @jest-environment node */
jest.mock("@/shared/db/repositories/orgs", () => ({
  getOrgById: jest.fn(),
  getOrgByStripeCustomerId: jest.fn(),
  updateOrgBilling: jest.fn(),
}));
jest.mock("@/shared/integrations/stripe/client", () => ({
  createProCheckoutSession: jest.fn(),
  createBillingPortalSession: jest.fn(),
  constructWebhookEvent: jest.fn(),
}));
jest.mock("@/shared/tenant/audit-log", () => ({ logTenantEvent: jest.fn() }));

import { POST } from "@/app/api/webhooks/stripe/route";
import * as orgs from "@/shared/db/repositories/orgs";
import type { Org } from "@/shared/db/schema";
import * as stripe from "@/shared/integrations/stripe/client";
import { logTenantEvent } from "@/shared/tenant/audit-log";

const construct = jest.mocked(stripe.constructWebhookEvent);
const updateOrgBilling = jest.mocked(orgs.updateOrgBilling);
const getOrgByStripeCustomerId = jest.mocked(orgs.getOrgByStripeCustomerId);

const org = (id: string): Org => ({
  id,
  name: null,
  slug: null,
  imageUrl: null,
  plan: "free",
  clerkOrgId: null,
  stripeCustomerId: "cus_1",
  stripeSubscriptionId: null,
  trialEndsAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});
const deliver = (event: unknown, signature: string | null = "t=1,v1=abc") => {
  construct.mockImplementation(() => JSON.parse(JSON.stringify(event)));
  return POST(
    new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify(event),
      headers: signature ? { "stripe-signature": signature } : {},
    }),
  );
};
const subscription = (type: string, object: Record<string, unknown>) => ({
  id: "evt_legacy",
  type,
  created: 1_800_000_000,
  data: { object: { id: "sub_1", customer: "cus_1", trial_end: null, ...object } },
});

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.COMMERCIAL_CATALOG_ENABLED;
});

describe("webhook do Stripe — comportamento atual do Pro (caracterização)", () => {
  it("sem cabeçalho de assinatura responde 400 e não lê o evento", async () => {
    const response = await deliver({ type: "x" }, null);
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("missing signature");
    expect(construct).not.toHaveBeenCalled();
    expect(updateOrgBilling).not.toHaveBeenCalled();
  });

  it("assinatura inválida responde 400 e não grava nada", async () => {
    construct.mockImplementation(() => {
      throw new TypeError("bad signature");
    });
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "forged" },
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("invalid signature");
    expect(updateOrgBilling).not.toHaveBeenCalled();
  });

  it("verifica a assinatura sobre o corpo cru recebido", async () => {
    const event = { id: "evt_1", type: "ping", data: { object: {} } };
    await deliver(event, "t=9,v1=sig");
    expect(construct).toHaveBeenCalledWith(JSON.stringify(event), "t=9,v1=sig");
  });

  it("checkout.session.completed liga o Pro do escritório do metadata", async () => {
    const response = await deliver({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { orgId: "org_a" },
          client_reference_id: "org_ignored",
          customer: "cus_1",
          subscription: "sub_1",
        },
      },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    expect(updateOrgBilling.mock.calls).toEqual([
      [
        "org_a",
        { plan: "pro", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" },
      ],
    ]);
  });

  it("checkout.session.completed sem metadata usa client_reference_id", async () => {
    await deliver({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: { metadata: null, client_reference_id: "org_b", customer: null },
      },
    });
    expect(updateOrgBilling.mock.calls).toEqual([
      [
        "org_b",
        { plan: "pro", stripeCustomerId: undefined, stripeSubscriptionId: undefined },
      ],
    ]);
  });

  it("checkout.session.completed sem escritório identificável não grava", async () => {
    const response = await deliver({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { metadata: {}, client_reference_id: null } },
    });
    expect(response.status).toBe(200);
    expect(updateOrgBilling).not.toHaveBeenCalled();
  });

  it.each([
    ["customer.subscription.created", "trialing", "pro"],
    ["customer.subscription.updated", "active", "pro"],
    ["customer.subscription.updated", "past_due", "free"],
    ["customer.subscription.updated", "unpaid", "free"],
    ["customer.subscription.updated", "incomplete", "free"],
    ["customer.subscription.deleted", "canceled", "free"],
  ])("%s com status %s espelha o plano %s", async (type, status, plan) => {
    await deliver(subscription(type, { status, metadata: { orgId: "org_a" } }));
    expect(updateOrgBilling.mock.calls).toEqual([
      [
        "org_a",
        {
          plan,
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_1",
          trialEndsAt: null,
        },
      ],
    ]);
  });

  it("assinatura sem metadata resolve o escritório pelo customer registrado e grava o fim do teste", async () => {
    getOrgByStripeCustomerId.mockResolvedValue(org("org_b"));
    await deliver(
      subscription("customer.subscription.updated", {
        status: "trialing",
        metadata: {},
        trial_end: 1_893_456_000,
      }),
    );
    expect(getOrgByStripeCustomerId).toHaveBeenCalledWith("cus_1");
    expect(updateOrgBilling.mock.calls).toEqual([
      [
        "org_b",
        {
          plan: "pro",
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_1",
          trialEndsAt: new Date(1_893_456_000_000),
        },
      ],
    ]);
  });

  it("assinatura de customer desconhecido não grava", async () => {
    getOrgByStripeCustomerId.mockResolvedValue(null);
    const response = await deliver(
      subscription("customer.subscription.updated", { status: "active", metadata: {} }),
    );
    expect(response.status).toBe(200);
    expect(updateOrgBilling).not.toHaveBeenCalled();
  });

  it.each(["invoice.paid", "invoice.payment_failed", "checkout.session.expired"])(
    "evento %s é aceito sem efeito",
    async (type) => {
      const response = await deliver({ id: "evt_1", type, data: { object: {} } });
      expect(response.status).toBe(200);
      expect(updateOrgBilling).not.toHaveBeenCalled();
      expect(getOrgByStripeCustomerId).not.toHaveBeenCalled();
    },
  );

  it("falha ao gravar é registrada sem dado do escritório e propagada para o provedor reenviar", async () => {
    updateOrgBilling.mockRejectedValue(new RangeError("db down"));
    await expect(
      deliver(
        subscription("customer.subscription.updated", {
          status: "active",
          metadata: { orgId: "org_a" },
        }),
      ),
    ).rejects.toThrow("db down");
    expect(jest.mocked(logTenantEvent).mock.calls).toEqual([
      [
        "error",
        {
          operation: "webhook.stripe customer.subscription.updated",
          outcome: "rejected",
          orgId: null,
          userId: null,
        },
      ],
    ]);
  });
});
