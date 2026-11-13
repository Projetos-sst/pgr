import { z } from "zod";

import { subscriptionStatusSchema } from "@/shared/domains/commercial/billing-model";
import { CHECKOUT_REFERENCE_KEY } from "@/shared/domains/commercial/checkout";
import type {
  ProviderEvent,
  ProviderEventReference,
} from "@/shared/domains/commercial/provider-event";

const instant = z
  .number()
  .int()
  .nonnegative()
  .transform((seconds) => new Date(seconds * 1000));
const optionalInstant = instant.nullish().transform((value) => value ?? null);
const providerId = z.string().min(1).max(255);
const expandable = z
  .union([providerId, z.object({ id: providerId }).transform((object) => object.id)])
  .nullish()
  .transform((value) => value ?? null);
const checkoutReference = z
  .record(z.string(), z.unknown())
  .nullish()
  .transform((metadata) => {
    const parsed = z.uuid().safeParse(metadata?.[CHECKOUT_REFERENCE_KEY]);
    return parsed.success ? parsed.data : null;
  });

const envelopeSchema = z.object({
  id: providerId,
  type: z.string().min(1),
  created: instant,
  livemode: z.literal(false),
  data: z.object({ object: z.unknown() }),
});
type Envelope = z.infer<typeof envelopeSchema>;

const sessionSchema = z.object({
  id: providerId,
  metadata: checkoutReference,
  customer: expandable,
  subscription: expandable,
});
const periodSchema = z.object({
  current_period_start: optionalInstant,
  current_period_end: optionalInstant,
});
const subscriptionSchema = periodSchema.extend({
  id: providerId,
  customer: expandable,
  status: subscriptionStatusSchema,
  metadata: checkoutReference,
  cancel_at_period_end: z.boolean().nullish(),
  canceled_at: optionalInstant,
  items: z
    .object({ data: z.array(periodSchema) })
    .nullish()
    .transform((items) => items?.data[0] ?? null),
});

type Normalized<T> = T extends ProviderEvent
  ? Omit<T, "providerEventId" | "type" | "occurredAt">
  : never;
type Normalizer = (object: unknown) => Normalized<ProviderEvent> | null;

function checkoutSession(object: unknown) {
  const session = sessionSchema.safeParse(object);
  if (!session.success || session.data.metadata === null) return null;
  const reference: ProviderEventReference = {
    checkoutId: session.data.metadata,
    providerSubscriptionId: session.data.subscription,
  };
  return { session: session.data, reference };
}

const checkoutCompleted: Normalizer = (object) => {
  const parsed = checkoutSession(object);
  return (
    parsed && {
      kind: "checkout_completed",
      reference: parsed.reference,
      providerSessionId: parsed.session.id,
      providerCustomerId: parsed.session.customer,
      providerSubscriptionId: parsed.session.subscription,
    }
  );
};

const checkoutExpired: Normalizer = (object) => {
  const parsed = checkoutSession(object);
  return (
    parsed && {
      kind: "checkout_expired",
      reference: parsed.reference,
      providerSessionId: parsed.session.id,
    }
  );
};

const subscriptionChanged: Normalizer = (object) => {
  const parsed = subscriptionSchema.safeParse(object);
  if (!parsed.success) return null;
  const subscription = parsed.data;
  const period = subscription.items ?? subscription;
  return {
    kind: "subscription",
    reference: {
      checkoutId: subscription.metadata,
      providerSubscriptionId: subscription.id,
    },
    snapshot: {
      providerSubscriptionId: subscription.id,
      providerCustomerId: subscription.customer,
      status: subscription.status,
      currentPeriodStart:
        period.current_period_start ?? subscription.current_period_start,
      currentPeriodEnd: period.current_period_end ?? subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      canceledAt: subscription.canceled_at,
    },
  };
};

export const STRIPE_EVENT_NORMALIZERS: Record<string, Normalizer> = {
  "checkout.session.completed": checkoutCompleted,
  "checkout.session.expired": checkoutExpired,
  "customer.subscription.created": subscriptionChanged,
  "customer.subscription.updated": subscriptionChanged,
  "customer.subscription.deleted": subscriptionChanged,
};

function normalize(envelope: Envelope): ProviderEvent | null {
  const normalizer = Object.entries(STRIPE_EVENT_NORMALIZERS).find(
    ([type]) => type === envelope.type,
  )?.[1];
  const normalized = normalizer ? normalizer(envelope.data.object) : null;
  return (
    normalized && {
      ...normalized,
      providerEventId: envelope.id,
      type: envelope.type,
      occurredAt: envelope.created,
    }
  );
}

export function normalizeStripeEvent(event: unknown): ProviderEvent | null {
  const envelope = envelopeSchema.safeParse(event);
  return envelope.success ? normalize(envelope.data) : null;
}
