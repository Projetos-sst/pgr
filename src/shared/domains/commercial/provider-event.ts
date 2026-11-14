import type { InvoiceStatus } from "./billing-model";
import type { InvoiceLine } from "./invoice";
import type { SubscriptionSnapshot } from "./subscription";

export type ProviderEventReference = {
  checkoutId: string | null;
  providerSubscriptionId: string | null;
};

type ProviderEventBase = {
  providerEventId: string;
  type: string;
  occurredAt: Date;
  reference: ProviderEventReference;
};

export type CheckoutCompletedEvent = ProviderEventBase & {
  kind: "checkout_completed";
  providerSessionId: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
};
export type OneOffPaidEvent = ProviderEventBase & {
  kind: "one_off_paid";
  providerSessionId: string;
  providerPaymentRef: string | null;
};
export type CheckoutExpiredEvent = ProviderEventBase & {
  kind: "checkout_expired";
  providerSessionId: string;
};
export type SubscriptionEvent = ProviderEventBase & {
  kind: "subscription";
  snapshot: SubscriptionSnapshot;
};
export type InvoiceSnapshot = {
  providerInvoiceId: string;
  status: InvoiceStatus;
  currency: string;
  totalCents: number;
  dueAt: Date | null;
  paidAt: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  lines: InvoiceLine[];
};
export type InvoiceEvent = ProviderEventBase & {
  kind: "invoice";
  invoice: InvoiceSnapshot;
};

export type ProviderEvent =
  | CheckoutCompletedEvent
  | OneOffPaidEvent
  | CheckoutExpiredEvent
  | SubscriptionEvent
  | InvoiceEvent;
