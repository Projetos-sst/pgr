/** @jest-environment node */
const mockCreate = jest.fn();
jest.mock("stripe", () => ({
  __esModule: true,
  default: jest.fn(() => ({ checkout: { sessions: { create: mockCreate } } })),
}));

import Stripe from "stripe";

import { createCommercialCheckoutSession } from "@/shared/integrations/stripe/client";

const request = {
  checkoutId: "11111111-1111-5111-8111-111111111111",
  lines: [{ providerPriceId: "price_a", quantity: 2 }],
  providerCustomerId: null,
  customerEmail: "financeiro@consultoria.test",
  successUrl: "https://app.test/plans?commercial_checkout=success",
  cancelUrl: "https://app.test/plans?commercial_checkout=cancelled",
};
const oldEnv = { ...process.env };

beforeEach(() => {
  mockCreate.mockReset();
  mockCreate.mockResolvedValue({
    id: "cs_test_1",
    url: "https://checkout.stripe.test/1",
    expires_at: 1_800_000_000,
  });
  jest.mocked(Stripe).mockClear();
});
afterEach(() => {
  process.env = { ...oldEnv };
});

describe("sessão de checkout comercial no Stripe", () => {
  it.each([
    ["sem chave configurada", undefined],
    ["com chave de produção", "sk_live_abc"],
    ["com chave restrita de produção", "rk_live_abc"],
  ])("%s recusa com BILLING_UNAVAILABLE e não chama o provedor", async (_name, key) => {
    process.env.STRIPE_SECRET_KEY = key;
    await expect(createCommercialCheckoutSession(request)).rejects.toMatchObject({
      code: "BILLING_UNAVAILABLE",
    });
    expect(Stripe).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("com chave de teste cria a assinatura com a referência do checkout e a chave de idempotência", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    const session = await createCommercialCheckoutSession(request);
    expect(session).toEqual({
      id: "cs_test_1",
      url: "https://checkout.stripe.test/1",
      expiresAt: new Date(1_800_000_000_000),
    });
    expect(mockCreate.mock.calls).toEqual([
      [
        {
          mode: "subscription",
          line_items: [{ price: "price_a", quantity: 2 }],
          subscription_data: { metadata: { commercialCheckoutId: request.checkoutId } },
          metadata: { commercialCheckoutId: request.checkoutId },
          client_reference_id: request.checkoutId,
          customer_email: "financeiro@consultoria.test",
          success_url: request.successUrl,
          cancel_url: request.cancelUrl,
        },
        { idempotencyKey: `commercial-checkout:${request.checkoutId}` },
      ],
    ]);
  });

  it("reaproveita o cliente já registrado no provedor e nunca envia o escritório no metadata", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    await createCommercialCheckoutSession({ ...request, providerCustomerId: "cus_1" });
    const [params] = mockCreate.mock.calls[0];
    expect(params.customer).toBe("cus_1");
    expect(params).not.toHaveProperty("customer_email");
    expect(JSON.stringify(params)).not.toContain("orgId");
  });

  it("sessão sem URL vira BILLING_UNAVAILABLE", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    mockCreate.mockResolvedValue({ id: "cs_test_1", url: null, expires_at: 1 });
    await expect(createCommercialCheckoutSession(request)).rejects.toMatchObject({
      code: "BILLING_UNAVAILABLE",
    });
  });
});
