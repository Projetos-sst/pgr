import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  isBillingSimulationEnabled,
  normalizedBillingEventSchema,
  type BillingGateway,
  type NormalizedBillingEvent,
  type PaymentChangeQuote,
  type PaymentInvoice,
  type SimulationEnvironment,
} from "@/shared/domains/billing/contracts";

/** Durable provider state belongs to the repository, never to a process-local map. */
export interface MockGatewayStore {
  subscription(id: string): Promise<NormalizedBillingEvent | null>;
  invoices(id: string): Promise<PaymentInvoice[]>;
  saveQuote(quote: PaymentChangeQuote): Promise<void>;
  applyQuote(id: string): Promise<void>;
  cancel(id: string, effectiveAt: string): Promise<void>;
  resume(id: string): Promise<void>;
}
/** Stable even when a webhook signing secret is rotated. */
export function mockCustomerIdentity(tenantId: string, customerId: string) {
  return `mock_${createHash("sha256").update(`${tenantId}:${customerId}`).digest("hex")}`;
}

export function createMockPaymentClient(input: {
  env: SimulationEnvironment;
  webhookSecret: string;
}): Pick<
  BillingGateway,
  | "provider"
  | "simulated"
  | "ensureCustomer"
  | "createCheckoutSession"
  | "createPortalSession"
  | "verifyAndNormalizeWebhook"
> {
  if (!isBillingSimulationEnabled(input.env))
    throw new Error("Simulação comercial desabilitada neste ambiente.");
  if (input.webhookSecret.length < 32)
    throw new Error(
      "Configure uma chave de webhook de simulação com pelo menos 32 caracteres.",
    );
  return {
    provider: "mock",
    simulated: true,
    async ensureCustomer({ tenantId, customerId }) {
      // Stable opaque identity; no email, CPF/CNPJ or other customer data leaves the app.
      return {
        providerCustomerId: mockCustomerIdentity(tenantId, customerId),
      };
    },
    async createCheckoutSession({ sessionId, expiresAt }) {
      return {
        sessionId,
        checkoutUrl: `/configuracoes/assinatura/simulacao?session=${encodeURIComponent(sessionId)}`,
        expiresAt,
      };
    },
    async createPortalSession({ sessionId, expiresAt }) {
      return {
        sessionId,
        portalUrl: `/configuracoes/assinatura/cobrancas?session=${encodeURIComponent(sessionId)}`,
        expiresAt,
      };
    },
    async verifyAndNormalizeWebhook(rawBody, signature) {
      const match = /^t=(\d{10}),v1=([a-f0-9]{64})$/.exec(signature);
      if (!match || Math.abs(Date.now() / 1000 - Number(match[1])) > 300)
        throw new Error("Assinatura de webhook inválida ou expirada.");
      const expected = createHmac("sha256", input.webhookSecret)
        .update(`${match[1]}.${rawBody}`)
        .digest();
      const received = Buffer.from(match[2], "hex");
      if (!timingSafeEqual(expected, received))
        throw new Error("Assinatura de webhook inválida.");
      return normalizedBillingEventSchema.parse(JSON.parse(rawBody));
    },
  };
}
export function createMockBillingGateway(input: {
  env: SimulationEnvironment;
  webhookSecret: string;
  store: MockGatewayStore;
}): BillingGateway {
  return {
    ...createMockPaymentClient(input),
    getSubscription: (id) => input.store.subscription(id),
    listInvoices: (id) => input.store.invoices(id),
    async previewChange(quote) {
      await input.store.saveQuote(quote);
      return quote;
    },
    applyChange: (id) => input.store.applyQuote(id),
    cancelSubscription: (id, at) => input.store.cancel(id, at),
    resumeSubscription: (id) => input.store.resume(id),
  };
}
