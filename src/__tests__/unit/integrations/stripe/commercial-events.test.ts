import { normalizeStripeEvent } from "@/shared/integrations/stripe/commercial-events";

const CHECKOUT = "11111111-1111-5111-8111-111111111111";
const event = (type: string, object: Record<string, unknown>, overrides = {}) => ({
  id: "evt_1",
  type,
  created: 1_800_000_000,
  livemode: false,
  data: { object },
  ...overrides,
});
const subscription = (overrides: Record<string, unknown> = {}) => ({
  id: "sub_1",
  customer: "cus_1",
  status: "active",
  metadata: { commercialCheckoutId: CHECKOUT },
  cancel_at_period_end: false,
  canceled_at: null,
  items: {
    data: [{ current_period_start: 1_799_000_000, current_period_end: 1_801_000_000 }],
  },
  ...overrides,
});
const base = {
  providerEventId: "evt_1",
  occurredAt: new Date(1_800_000_000_000),
};

describe("normalização dos eventos do Stripe para o fluxo comercial", () => {
  it("checkout concluído carrega a referência do checkout, a sessão, o cliente e a assinatura", () => {
    expect(
      normalizeStripeEvent(
        event("checkout.session.completed", {
          id: "cs_1",
          metadata: { commercialCheckoutId: CHECKOUT },
          client_reference_id: CHECKOUT,
          customer: { id: "cus_1" },
          subscription: "sub_1",
        }),
      ),
    ).toEqual({
      ...base,
      kind: "checkout_completed",
      type: "checkout.session.completed",
      reference: { checkoutId: CHECKOUT, providerSubscriptionId: "sub_1" },
      providerSessionId: "cs_1",
      providerCustomerId: "cus_1",
      providerSubscriptionId: "sub_1",
    });
  });

  it("checkout expirado carrega só a sessão", () => {
    expect(
      normalizeStripeEvent(
        event("checkout.session.expired", {
          id: "cs_1",
          metadata: { commercialCheckoutId: CHECKOUT },
        }),
      ),
    ).toMatchObject({
      kind: "checkout_expired",
      providerSessionId: "cs_1",
      reference: { checkoutId: CHECKOUT, providerSubscriptionId: null },
    });
  });

  it("checkout do Pro antigo (metadata com o escritório, sem referência comercial) não é do fluxo novo", () => {
    expect(
      normalizeStripeEvent(
        event("checkout.session.completed", {
          id: "cs_1",
          metadata: { orgId: "org_a" },
          client_reference_id: "org_a",
          customer: "cus_1",
          subscription: "sub_1",
        }),
      ),
    ).toBeNull();
  });

  it.each([
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ])("%s vira o retrato da assinatura com o período do item", (type) => {
    expect(normalizeStripeEvent(event(type, subscription()))).toEqual({
      ...base,
      kind: "subscription",
      type,
      reference: { checkoutId: CHECKOUT, providerSubscriptionId: "sub_1" },
      snapshot: {
        providerSubscriptionId: "sub_1",
        providerCustomerId: "cus_1",
        status: "active",
        currentPeriodStart: new Date(1_799_000_000_000),
        currentPeriodEnd: new Date(1_801_000_000_000),
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    });
  });

  it("aceita o período no nível da assinatura, cancelamento agendado e data de cancelamento", () => {
    const normalized = normalizeStripeEvent(
      event(
        "customer.subscription.updated",
        subscription({
          items: undefined,
          current_period_start: 10,
          current_period_end: 20,
          cancel_at_period_end: true,
          canceled_at: 15,
          status: "canceled",
        }),
      ),
    );
    expect(normalized).toMatchObject({
      snapshot: {
        status: "canceled",
        currentPeriodStart: new Date(10_000),
        currentPeriodEnd: new Date(20_000),
        cancelAtPeriodEnd: true,
        canceledAt: new Date(15_000),
      },
    });
  });

  it("assinatura sem referência comercial segue com a busca pelo id registrado", () => {
    expect(
      normalizeStripeEvent(
        event(
          "customer.subscription.updated",
          subscription({ metadata: { orgId: "x" } }),
        ),
      ),
    ).toMatchObject({
      reference: { checkoutId: null, providerSubscriptionId: "sub_1" },
    });
  });

  it("referência que não é UUID é descartada em vez de chegar ao banco", () => {
    expect(
      normalizeStripeEvent(
        event(
          "customer.subscription.updated",
          subscription({ metadata: { commercialCheckoutId: "org_a'; drop table x" } }),
        ),
      ),
    ).toMatchObject({ reference: { checkoutId: null } });
  });

  it("evento de produção (livemode) nunca entra no fluxo comercial", () => {
    expect(
      normalizeStripeEvent(
        event("customer.subscription.updated", subscription(), { livemode: true }),
      ),
    ).toBeNull();
  });

  it.each([
    ["tipo desconhecido", event("charge.succeeded", { id: "ch_1" })],
    [
      "estado que o espelho não conhece",
      event("customer.subscription.updated", subscription({ status: "weird" })),
    ],
    [
      "assinatura sem id",
      event("customer.subscription.updated", subscription({ id: undefined })),
    ],
    [
      "envelope sem id",
      { type: "customer.subscription.updated", data: { object: subscription() } },
    ],
    ["nulo", null],
  ])("%s não é do fluxo comercial", (_name, raw) => {
    expect(normalizeStripeEvent(raw)).toBeNull();
  });
});
