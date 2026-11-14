import type {
  BillingPeriod,
  CommercialService,
  CommercialUnit,
  OfferQuota,
} from "@/shared/domains/commercial/offer";
import type { PaymentState } from "@/shared/domains/commercial/plans-overview";
import type { ActionError } from "@/shared/server/result";

export type CheckoutStep = "contract" | "checkout";
export type CheckoutReturn = "success" | "cancelled";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const FICTITIOUS_BADGE = "Catálogo fictício — não é oferta comercial";
export const PROCESSING_NOTICE =
  "Pagamento em processamento — a liberação acontece quando o provedor confirmar";
export const CANCELLED_NOTICE =
  "Pagamento cancelado — nenhuma cobrança foi feita. Você pode tentar de novo quando quiser.";

export function formatBrl(cents: number): string {
  return BRL.format(cents / 100);
}

export const PERIOD_LABEL: Record<BillingPeriod, string> = {
  monthly: "por mês",
  annual: "por ano",
  one_time: "pagamento único",
};

export const SERVICE_LABEL: Record<CommercialService, string> = {
  pgr: "PGR",
  medicine: "Medicina",
  pro: "Pro",
  one_off: "Avulso",
};

export const UNIT_LABEL: Record<CommercialUnit, string> = {
  organization: "por escritório",
  company: "por empresa",
  employee: "por funcionário",
  document: "por documento",
};

export const PAYMENT_LABEL: Record<PaymentState, string> = {
  released: "Liberada",
  processing: "Aguardando confirmação do provedor",
  pending: "Pagamento pendente",
};

export function quotaLabel(quota: OfferQuota): string {
  return `${quota.metric.replaceAll("_", " ")}: ${quota.limit.toLocaleString("pt-BR")}`;
}

export function formatCivilDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function checkoutReturnOf(
  value: string | string[] | undefined,
): CheckoutReturn | null {
  if (value === "success" || value === "cancelled") return value;
  return null;
}

const GENERIC_ERROR = "Não foi possível concluir a contratação. Tente novamente.";

const ERROR_MESSAGES: Record<string, string> = {
  BILLING_UNAVAILABLE: "Pagamento indisponível neste ambiente",
  FORBIDDEN: "Apenas o administrador contrata.",
  UNAUTHORIZED: "Sua sessão expirou. Entre novamente para contratar.",
  NO_TENANT_CONTEXT: "Escolha um escritório para contratar.",
};

const STEP_VALIDATION: Record<CheckoutStep, (message: string) => string> = {
  contract: (message) => message,
  checkout: (message) =>
    `Esta oferta ainda não tem preço mapeado no provedor de pagamento. ${message}`,
};

export function messageFor(step: CheckoutStep, error: ActionError): string {
  if (error.code === "VALIDATION") return STEP_VALIDATION[step](error.message);
  return ERROR_MESSAGES[error.code] ?? (error.message || GENERIC_ERROR);
}
