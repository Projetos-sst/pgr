const mockResolve = jest.fn();
const mockRecord = jest.fn();
jest.mock("@/shared/db/repositories/billing-ledger", () => ({
  resolveBillingLink: (...args: unknown[]) => mockResolve(...args),
  recordProviderEvent: (...args: unknown[]) => mockRecord(...args),
}));

import { handleCommercialStripeEvent } from "@/shared/server/commercial/commercial-webhook";

const CHECKOUT = "11111111-1111-5111-8111-111111111111";
const event = {
  id: "evt_1",
  type: "customer.subscription.updated",
  created: 1_800_000_000,
  livemode: false,
  data: {
    object: {
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      metadata: { commercialCheckoutId: CHECKOUT },
    },
  },
};
const link = { orgId: "org_a", contractId: "c1" };
const oldEnv = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.COMMERCIAL_CATALOG_ENABLED = "true";
});
afterEach(() => {
  process.env = { ...oldEnv };
});

describe("roteamento do webhook para o fluxo comercial", () => {
  it.each([undefined, "false", "1", "TRUE"])(
    "com a flag %s não consulta o banco e devolve o evento ao caminho antigo",
    async (flag) => {
      process.env.COMMERCIAL_CATALOG_ENABLED = flag;
      expect(await handleCommercialStripeEvent(event)).toBe(false);
      expect(mockResolve).not.toHaveBeenCalled();
    },
  );

  it("evento que o fluxo novo não reconhece volta ao caminho antigo sem consultar o banco", async () => {
    expect(await handleCommercialStripeEvent({ ...event, type: "invoice.created" })).toBe(
      false,
    );
    expect(await handleCommercialStripeEvent({ ...event, livemode: true })).toBe(false);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("evento sem vínculo registrado volta ao caminho antigo sem gravar", async () => {
    mockResolve.mockResolvedValue(null);
    expect(await handleCommercialStripeEvent(event)).toBe(false);
    expect(mockResolve).toHaveBeenCalledWith({
      checkoutId: CHECKOUT,
      providerSubscriptionId: "sub_1",
    });
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("evento com vínculo registrado é gravado no escritório do vínculo e não segue para o caminho antigo", async () => {
    mockResolve.mockResolvedValue(link);
    expect(await handleCommercialStripeEvent(event)).toBe(true);
    expect(mockRecord).toHaveBeenCalledWith(
      link,
      expect.objectContaining({ kind: "subscription", providerEventId: "evt_1" }),
    );
  });

  it("falha ao gravar é propagada para o provedor reenviar", async () => {
    mockResolve.mockResolvedValue(link);
    mockRecord.mockRejectedValue(new RangeError("db down"));
    await expect(handleCommercialStripeEvent(event)).rejects.toThrow("db down");
  });
});
