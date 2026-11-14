import type {
  EntitlementStatus,
  InvoiceStatus,
  SubscriptionStatus,
} from "./billing-model";
import type { ServiceTotals } from "./invoice";
import {
  PROVISIONAL_DELINQUENCY_POLICY,
  subscriptionAccess,
  type SubscriptionAccess,
} from "./subscription";

export type SheetAction = "manage_in_portal" | "resume_checkout";
export type AccessState = "granted" | "suspended" | "legacy" | "none";

export type ActionFacts = {
  paymentAvailable: boolean;
  hasProviderCustomer: boolean;
  hasOpenCheckout: boolean;
};

const ACTION_RULES: { action: SheetAction; applies: (facts: ActionFacts) => boolean }[] =
  [
    { action: "manage_in_portal", applies: (facts) => facts.hasProviderCustomer },
    { action: "resume_checkout", applies: (facts) => facts.hasOpenCheckout },
  ];

export function availableActions(facts: ActionFacts): SheetAction[] {
  if (!facts.paymentAvailable) return [];
  return ACTION_RULES.filter((rule) => rule.applies(facts)).map((rule) => rule.action);
}

export type RightFacts = { status: EntitlementStatus; applied: boolean };

export function rightAccessState(right: RightFacts): AccessState {
  if (right.status !== "active") return "suspended";
  return right.applied ? "granted" : "legacy";
}

const ACCESS_PRIORITY: AccessState[] = ["granted", "legacy", "suspended"];

export function contractAccessState(rights: readonly RightFacts[]): AccessState {
  const states = rights.map(rightAccessState);
  return ACCESS_PRIORITY.find((state) => states.includes(state)) ?? "none";
}

export type SubscriptionFacts = {
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
};

export type ScheduledAccess = SubscriptionAccess & { until: Date | null };

export function subscriptionAccessAt(
  subscription: SubscriptionFacts,
  asOf: Date,
): ScheduledAccess {
  const access = subscriptionAccess(subscription.status, {
    dueAt: null,
    asOf,
    policy: PROVISIONAL_DELINQUENCY_POLICY,
  });
  const keepsUntilEnd = access.granted && subscription.cancelAtPeriodEnd;
  return { ...access, until: keepsUntilEnd ? subscription.currentPeriodEnd : null };
}

export const ACCESS_LABEL: Record<AccessState, string> = {
  granted: "Acesso liberado",
  legacy: "Acesso legado ou cortesia",
  suspended: "Acesso suspenso",
  none: "Sem direito de uso registrado",
};

export const FINANCIAL_LABEL: Record<SubscriptionStatus | "none", string> = {
  none: "Sem assinatura no provedor",
  incomplete: "Pagamento não concluído",
  incomplete_expired: "Pagamento expirado",
  trialing: "Em teste",
  active: "Em dia",
  past_due: "Pagamento em atraso",
  unpaid: "Não pago",
  canceled: "Cancelada",
  paused: "Pausada",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  open: "Em aberto",
  paid: "Paga",
  void: "Anulada",
  uncollectible: "Incobrável",
};

export const PORTAL_NOTICE =
  "Mudança de plano, cancelamento e reativação são feitos no portal do provedor.";
export const PAYMENT_METHOD_TEXT = "Gerenciado no portal do provedor";
export const INVOICE_NOTICE = "Fatura de cobrança não é nota fiscal";

export type InvoiceBreakdownRow = {
  key: "pgr" | "medicine" | "other" | "unclassified";
  label: string;
  cents: number;
};

export function invoiceBreakdown(totals: ServiceTotals): InvoiceBreakdownRow[] {
  return [
    { key: "pgr", label: "PGR", cents: totals.pgr },
    { key: "medicine", label: "Medicina", cents: totals.medicine },
    { key: "other", label: "Demais", cents: totals.pro + totals.one_off },
    { key: "unclassified", label: "Não classificado", cents: totals.unclassified },
  ];
}
