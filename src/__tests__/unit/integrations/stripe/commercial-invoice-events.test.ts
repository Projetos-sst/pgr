import { normalizeStripeEvent } from "@/shared/integrations/stripe/commercial-events";

const CHECKOUT = "11111111-1111-5111-8111-111111111111";
const invoice = (overrides: Record<string, unknown> = {}) => ({
  id: "in_1",
  status: "paid",
  currency: "brl",
  total: 33300,
  due_date: null,
  period_start: 1_799_000_000,
  period_end: 1_801_000_000,
  status_transitions: { finalized_at: 1_799_990_000, paid_at: 1_799_999_000 },
  parent: {
    subscription_details: {
      subscription: "sub_1",
      metadata: { commercialCheckoutId: CHECKOUT },
    },
  },
  lines: {
    data: [
      {
        description: "1 × PGR",
        amount: 11100,
        quantity: 1,
        pricing: { price_details: { price: "price_pgr" } },
      },
      { description: null, amount: 22200, quantity: 2, price: { id: "price_med" } },
      { description: "Ajuste", amount: -100 },
    ],
  },
  ...overrides,
});
const event = (type: string, object: Record<string, unknown>) => ({
  id: "evt_1",
  type,
  created: 1_800_000_000,
  livemode: false,
  data: { object },
});

describe("normalização dos eventos de fatura do Stripe", () => {
  it.each([
    "invoice.finalized",
    "invoice.paid",
    "invoice.payment_failed",
    "invoice.voided",
    "invoice.marked_uncollectible",
  ])(
    "%s vira o retrato da fatura com as linhas e o preço do provedor de cada uma",
    (type) => {
      expect(normalizeStripeEvent(event(type, invoice()))).toEqual({
        kind: "invoice",
        type,
        providerEventId: "evt_1",
        occurredAt: new Date(1_800_000_000_000),
        reference: { checkoutId: CHECKOUT, providerSubscriptionId: "sub_1" },
        invoice: {
          providerInvoiceId: "in_1",
          status: "paid",
          currency: "BRL",
          totalCents: 33300,
          dueAt: new Date(1_799_990_000_000),
          paidAt: new Date(1_799_999_000_000),
          periodStart: new Date(1_799_000_000_000),
          periodEnd: new Date(1_801_000_000_000),
          lines: [
            {
              providerPriceId: "price_pgr",
              label: "1 × PGR",
              quantity: 1,
              amountCents: 11100,
            },
            { providerPriceId: "price_med", label: "", quantity: 2, amountCents: 22200 },
            { providerPriceId: null, label: "Ajuste", quantity: 1, amountCents: -100 },
          ],
        },
      });
    },
  );

  it("o vencimento informado pelo provedor prevalece sobre a data de fechamento", () => {
    expect(
      normalizeStripeEvent(
        event(
          "invoice.payment_failed",
          invoice({ status: "open", due_date: 1_800_500_000 }),
        ),
      ),
    ).toMatchObject({
      invoice: {
        status: "open",
        dueAt: new Date(1_800_500_000_000),
        paidAt: expect.any(Date),
      },
    });
  });

  it("aceita o formato antigo com a assinatura no nível da fatura", () => {
    expect(
      normalizeStripeEvent(
        event(
          "invoice.paid",
          invoice({
            parent: null,
            subscription: "sub_9",
            subscription_details: { metadata: { commercialCheckoutId: CHECKOUT } },
          }),
        ),
      ),
    ).toMatchObject({
      reference: { checkoutId: CHECKOUT, providerSubscriptionId: "sub_9" },
    });
  });

  it("rascunho de fatura e fatura sem assinatura nem referência não entram no fluxo comercial", () => {
    expect(
      normalizeStripeEvent(event("invoice.finalized", invoice({ status: "draft" }))),
    ).toBeNull();
    expect(
      normalizeStripeEvent(event("invoice.paid", invoice({ parent: null }))),
    ).toBeNull();
    expect(normalizeStripeEvent(event("invoice.created", invoice()))).toBeNull();
  });
});
