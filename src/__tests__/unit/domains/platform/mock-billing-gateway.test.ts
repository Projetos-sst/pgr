import { createHmac } from "node:crypto";
import {
  createMockBillingGateway,
  type MockGatewayStore,
} from "@/shared/integrations/billing/mock-gateway";

const secret = "test-only-secret-at-least-32-characters";
const store: MockGatewayStore = {
  subscription: jest.fn().mockResolvedValue(null),
  invoices: jest.fn().mockResolvedValue([]),
  saveQuote: jest.fn(),
  applyQuote: jest.fn(),
  cancel: jest.fn(),
  resume: jest.fn(),
};
const env = { APP_ENV: "test", BILLING_MODE: "mock", BILLING_MOCK_ENABLED: "true" };
const event = {
  eventId: "event-1",
  contractId: "11111111-1111-4111-8111-111111111111",
  revision: 1,
  status: "active",
  periodStart: "2030-01-01T00:00:00Z",
  periodEnd: "2030-02-01T00:00:00Z",
  occurredAt: "2030-01-01T00:00:00Z",
  kind: "payment_confirmed",
};
function signed(body: string, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}
describe("isolated simulated payment gateway", () => {
  const gateway = () => createMockBillingGateway({ env, webhookSecret: secret, store });
  it("refuses production and incomplete opt-in", () => {
    expect(() =>
      createMockBillingGateway({
        env: { ...env, APP_ENV: "production" },
        webhookSecret: secret,
        store,
      }),
    ).toThrow();
    expect(() =>
      createMockBillingGateway({ env, webhookSecret: "short", store }),
    ).toThrow();
  });
  it("verifies the exact raw body, freshness, schema and signature", async () => {
    const body = JSON.stringify(event);
    await expect(
      gateway().verifyAndNormalizeWebhook(body, signed(body)),
    ).resolves.toEqual(event);
    await expect(
      gateway().verifyAndNormalizeWebhook(body + " ", signed(body)),
    ).rejects.toThrow();
    await expect(
      gateway().verifyAndNormalizeWebhook(body, signed(body, 1_000_000_000)),
    ).rejects.toThrow();
    await expect(gateway().verifyAndNormalizeWebhook(body, "x")).rejects.toThrow();
    const injected = JSON.stringify({ ...event, actor: "someone-else" });
    await expect(
      gateway().verifyAndNormalizeWebhook(injected, signed(injected)),
    ).rejects.toThrow();
  });
  it("uses durable storage and a stable tenant-specific customer identity", async () => {
    const one = await gateway().ensureCustomer({
      tenantId: "one",
      customerId: "customer",
    });
    expect(
      await gateway().ensureCustomer({ tenantId: "one", customerId: "customer" }),
    ).toEqual(one);
    expect(
      await gateway().ensureCustomer({ tenantId: "two", customerId: "customer" }),
    ).not.toEqual(one);
    await gateway().getSubscription(event.contractId);
    expect(store.subscription).toHaveBeenCalledWith(event.contractId);
  });
});
