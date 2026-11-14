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
const session = (overrides: Record<string, unknown> = {}) => ({
  id: "cs_1",
  mode: "payment",
  payment_status: "paid",
  payment_intent: "pi_1",
  metadata: { commercialCheckoutId: CHECKOUT },
  customer: "cus_1",
  subscription: null,
  ...overrides,
});

describe("normalização do pagamento único do Stripe", () => {
  it("checkout em modo payment com pagamento confirmado vira one_off_paid", () => {
    expect(normalizeStripeEvent(event("checkout.session.completed", session()))).toEqual({
      kind: "one_off_paid",
      type: "checkout.session.completed",
      providerEventId: "evt_1",
      occurredAt: new Date(1_800_000_000_000),
      reference: { checkoutId: CHECKOUT, providerSubscriptionId: null },
      providerSessionId: "cs_1",
      providerPaymentRef: "pi_1",
    });
  });

  it("pagamento assíncrono confirmado também vira one_off_paid", () => {
    expect(
      normalizeStripeEvent(event("checkout.session.async_payment_succeeded", session())),
    ).toMatchObject({ kind: "one_off_paid", providerSessionId: "cs_1" });
  });

  it.each([
    ["unpaid", { payment_status: "unpaid" }],
    ["sem estado de pagamento", { payment_status: null }],
  ])("modo payment %s é ignorado", (_name, overrides) => {
    expect(
      normalizeStripeEvent(event("checkout.session.completed", session(overrides))),
    ).toBeNull();
  });

  it("o evento de pagamento assíncrono de sessão de assinatura é ignorado", () => {
    expect(
      normalizeStripeEvent(
        event(
          "checkout.session.async_payment_succeeded",
          session({ mode: "subscription", subscription: "sub_1" }),
        ),
      ),
    ).toBeNull();
  });

  it("sessão de assinatura, com ou sem o modo informado, mantém o checkout_completed de sempre", () => {
    for (const overrides of [
      { mode: "subscription", payment_status: "paid", subscription: "sub_1" },
      { mode: undefined, payment_status: undefined, subscription: "sub_1" },
    ])
      expect(
        normalizeStripeEvent(event("checkout.session.completed", session(overrides))),
      ).toMatchObject({
        kind: "checkout_completed",
        providerSubscriptionId: "sub_1",
        providerCustomerId: "cus_1",
      });
  });

  it("evento em produção e sessão sem vínculo comercial são ignorados", () => {
    expect(
      normalizeStripeEvent(
        event("checkout.session.completed", session(), { livemode: true }),
      ),
    ).toBeNull();
    expect(
      normalizeStripeEvent(
        event("checkout.session.completed", session({ metadata: {} })),
      ),
    ).toBeNull();
  });

  it("sem payment_intent o pagamento é registrado sem referência", () => {
    expect(
      normalizeStripeEvent(
        event("checkout.session.completed", session({ payment_intent: null })),
      ),
    ).toMatchObject({ kind: "one_off_paid", providerPaymentRef: null });
  });
});
