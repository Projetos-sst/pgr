import type { SubscriptionStatus } from "@/shared/domains/commercial/billing-model";
import type {
  AdminDivergence,
  AdminPriceItem,
} from "@/shared/domains/commercial/admin-subscriptions";

import type { StatusTone } from "../../../_ui/status-badge";

const MONEY = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });
const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export const formatMoney = (cents: number) => MONEY.format(cents / 100);

export const formatDay = (iso: string | null) => (iso ? DATE.format(new Date(iso)) : "—");

export const formatInstant = (iso: string | null) =>
  iso ? DATE_TIME.format(new Date(iso)) : "—";

export const formatPeriod = (start: string | null, end: string | null) =>
  start || end ? `${formatDay(start)} a ${formatDay(end)}` : "—";

export const SERVICE_LABELS: Record<string, string> = {
  pgr: "PGR",
  medicine: "Medicina",
  pro: "Pro",
  one_off: "Avulso",
};

export const UNIT_LABELS: Record<string, string> = {
  organization: "por escritório",
  company: "por empresa",
  employee: "por funcionário",
  document: "por documento",
};

export const PERIOD_LABELS: Record<string, string> = {
  monthly: "mensal",
  annual: "anual",
  one_time: "pagamento único",
};

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  incomplete: "Incompleta",
  incomplete_expired: "Expirada sem pagamento",
  trialing: "Em teste",
  active: "Ativa",
  past_due: "Pagamento em atraso",
  unpaid: "Não paga",
  canceled: "Cancelada",
  paused: "Pausada",
};

const STATUS_TONES: Record<SubscriptionStatus, StatusTone> = {
  incomplete: "amber",
  incomplete_expired: "red",
  trialing: "green",
  active: "green",
  past_due: "amber",
  unpaid: "red",
  canceled: "red",
  paused: "amber",
};

export const statusTone = (status: SubscriptionStatus): StatusTone =>
  STATUS_TONES[status];

const DIVERGENCE_TONES: Record<AdminDivergence, StatusTone> = {
  none: "green",
  entitlement_mismatch: "red",
  no_entitlements: "amber",
  never_synced: "amber",
};

export const divergenceTone = (divergence: AdminDivergence): StatusTone =>
  DIVERGENCE_TONES[divergence];

export const describeItem = (item: AdminPriceItem) =>
  `${SERVICE_LABELS[item.service] ?? item.service} · ${item.label}: ${formatMoney(item.unitAmountCents)} ${UNIT_LABELS[item.unit] ?? item.unit}`;
