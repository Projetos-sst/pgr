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
export type CheckoutExpiredEvent = ProviderEventBase & {
  kind: "checkout_expired";
  providerSessionId: string;
};
export type SubscriptionEvent = ProviderEventBase & {
  kind: "subscription";
  snapshot: SubscriptionSnapshot;
};

export type ProviderEvent =
  | CheckoutCompletedEvent
  | CheckoutExpiredEvent
  | SubscriptionEvent;
