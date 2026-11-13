import type { SubscriptionStatus } from "./billing-model";

const DAY_MS = 86_400_000;

export type DelinquencyPolicy = { graceDays: number };
export const PROVISIONAL_DELINQUENCY_POLICY: DelinquencyPolicy = { graceDays: 0 };

export type AccessContext = {
  dueAt: Date | null;
  asOf: Date;
  policy: DelinquencyPolicy;
};
export type SubscriptionAccess = { granted: boolean; reason: string };

const granted = (reason: string) => (): SubscriptionAccess => ({ granted: true, reason });
const denied = (reason: string) => (): SubscriptionAccess => ({ granted: false, reason });

function pastDueAccess({ dueAt, asOf, policy }: AccessContext): SubscriptionAccess {
  const withinGrace =
    policy.graceDays > 0 &&
    dueAt !== null &&
    asOf.getTime() <= dueAt.getTime() + policy.graceDays * DAY_MS;
  return withinGrace
    ? { granted: true, reason: "payment_past_due_within_grace" }
    : { granted: false, reason: "payment_past_due" };
}

const ACCESS_BY_STATUS: Record<
  SubscriptionStatus,
  (context: AccessContext) => SubscriptionAccess
> = {
  active: granted("subscription_active"),
  trialing: granted("subscription_trialing"),
  past_due: pastDueAccess,
  unpaid: denied("subscription_unpaid"),
  canceled: denied("subscription_canceled"),
  incomplete: denied("subscription_incomplete"),
  incomplete_expired: denied("subscription_incomplete_expired"),
  paused: denied("subscription_paused"),
};

export function subscriptionAccess(
  status: SubscriptionStatus,
  context: AccessContext,
): SubscriptionAccess {
  return ACCESS_BY_STATUS[status](context);
}

const FINAL_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  "canceled",
  "incomplete_expired",
]);

export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  if (from === to) return true;
  return !FINAL_STATUSES.has(from) && to !== "incomplete";
}

export type SubscriptionSnapshot = {
  providerSubscriptionId: string;
  providerCustomerId: string | null;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
};
export type SubscriptionMirror = SubscriptionSnapshot & { lastEventAt: Date | null };
export type MirrorDecision =
  | { outcome: "applied"; next: SubscriptionMirror }
  | { outcome: "stale" | "ignored"; detail: string };

const REJECTIONS: {
  outcome: "stale" | "ignored";
  detail: (current: SubscriptionMirror, snapshot: SubscriptionSnapshot) => string;
  applies: (
    current: SubscriptionMirror,
    snapshot: SubscriptionSnapshot,
    occurredAt: Date,
  ) => boolean;
}[] = [
  {
    outcome: "ignored",
    detail: () => "another_subscription_for_contract",
    applies: (current, snapshot) =>
      current.providerSubscriptionId !== snapshot.providerSubscriptionId,
  },
  {
    outcome: "stale",
    detail: () => "older_than_last_applied",
    applies: (current, _snapshot, occurredAt) =>
      current.lastEventAt !== null && occurredAt < current.lastEventAt,
  },
  {
    outcome: "stale",
    detail: (current, snapshot) =>
      `transition_not_allowed:${current.status}->${snapshot.status}`,
    applies: (current, snapshot) => !canTransition(current.status, snapshot.status),
  },
];

export function applySubscriptionSnapshot(
  current: SubscriptionMirror | null,
  snapshot: SubscriptionSnapshot,
  occurredAt: Date,
): MirrorDecision {
  const rejection =
    current && REJECTIONS.find((rule) => rule.applies(current, snapshot, occurredAt));
  if (current && rejection)
    return { outcome: rejection.outcome, detail: rejection.detail(current, snapshot) };
  return {
    outcome: "applied",
    next: {
      ...snapshot,
      providerCustomerId:
        snapshot.providerCustomerId ?? current?.providerCustomerId ?? null,
      lastEventAt: occurredAt,
    },
  };
}
