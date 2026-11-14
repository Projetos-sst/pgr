import { z } from "zod";

import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { PAGE_SIZE_MAX } from "@/shared/pagination";

import {
  subscriptionStatusSchema,
  type EntitlementStatus,
  type SubscriptionStatus,
} from "./billing-model";
import {
  PROVISIONAL_DELINQUENCY_POLICY,
  subscriptionAccess,
  type SubscriptionMirror,
  type SubscriptionSnapshot,
} from "./subscription";

export const RECONCILIATION_REASON_MIN_LENGTH = 10;
export const RECONCILIATION_REASON_MAX_LENGTH = 500;

export const ADMIN_SERVICES = ["pgr", "medicine", "pro"] as const;
export type AdminService = (typeof ADMIN_SERVICES)[number];

export type ReconciliationResult = "no_change" | "corrected" | "source_unavailable";
export type ReconciliationSource = "provider" | "mirror";
export type AdminDivergence =
  | "none"
  | "entitlement_mismatch"
  | "no_entitlements"
  | "never_synced";

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blankToUndefined, schema.optional());

export const adminSubscriptionFiltersSchema = z
  .object({
    orgId: optional(z.string().trim().min(1).max(100)),
    companyId: optional(requiredUuid("Empresa inválida.")),
    service: optional(z.enum(ADMIN_SERVICES)),
    status: optional(subscriptionStatusSchema),
    from: optional(z.iso.date()),
    to: optional(z.iso.date()),
    search: optional(z.string().trim().min(1).max(100)),
    page: optional(z.coerce.number().int().min(1)),
    pageSize: optional(z.coerce.number().int().min(1).max(PAGE_SIZE_MAX)),
  })
  .refine((filters) => !filters.from || !filters.to || filters.from <= filters.to, {
    message: "O período inicial não pode ser depois do final.",
    path: ["from"],
  });
export type AdminSubscriptionFilters = z.infer<typeof adminSubscriptionFiltersSchema>;

export const reconciliationReasonSchema = z
  .string({ error: "Informe o motivo da reconciliação." })
  .trim()
  .min(
    RECONCILIATION_REASON_MIN_LENGTH,
    `O motivo precisa ter ao menos ${RECONCILIATION_REASON_MIN_LENGTH} caracteres.`,
  )
  .max(RECONCILIATION_REASON_MAX_LENGTH, "O motivo é longo demais.");

export const targetSchema = z.object({
  orgId: z
    .string({ error: "Escritório inválido." })
    .trim()
    .min(1, "Escritório inválido."),
  contractId: requiredUuid("Contratação inválida."),
});

export const reconcileInputSchema = targetSchema.extend({
  reason: reconciliationReasonSchema,
});
export type ReconcileInput = z.infer<typeof reconcileInputSchema>;

export function subscriptionDivergence(input: {
  mirror: { status: SubscriptionStatus; lastEventAt: Date | null } | null;
  entitlements: readonly { status: "active" | "inactive" }[];
  asOf: Date;
}): AdminDivergence {
  const { mirror, entitlements, asOf } = input;
  if (!mirror) return "never_synced";
  if (entitlements.length === 0) return "no_entitlements";
  const access = subscriptionAccess(mirror.status, {
    dueAt: null,
    asOf,
    policy: PROVISIONAL_DELINQUENCY_POLICY,
  });
  const expected = access.granted ? "active" : "inactive";
  if (entitlements.every((row) => row.status === expected)) return "none";
  return mirror.lastEventAt === null ? "never_synced" : "entitlement_mismatch";
}

const instant = (value: Date | null) => value?.getTime() ?? null;

export function mirrorFieldsChanged(
  before: SubscriptionMirror | null,
  after: SubscriptionMirror | null,
): boolean {
  if (!before || !after) return before !== after;
  return (
    before.providerSubscriptionId !== after.providerSubscriptionId ||
    before.providerCustomerId !== after.providerCustomerId ||
    before.status !== after.status ||
    before.cancelAtPeriodEnd !== after.cancelAtPeriodEnd ||
    instant(before.currentPeriodStart) !== instant(after.currentPeriodStart) ||
    instant(before.currentPeriodEnd) !== instant(after.currentPeriodEnd) ||
    instant(before.canceledAt) !== instant(after.canceledAt)
  );
}

export function entitlementsChangedCount(
  before: readonly { id: string; status: string; reason: string }[],
  after: readonly { id: string; status: string; reason: string }[],
): number {
  return after.filter((row) => {
    const previous = before.find((candidate) => candidate.id === row.id);
    return !previous || previous.status !== row.status || previous.reason !== row.reason;
  }).length;
}

export function reconciliationResult(input: {
  sourceChecked: boolean;
  changed: boolean;
}): ReconciliationResult {
  if (!input.sourceChecked) return "source_unavailable";
  return input.changed ? "corrected" : "no_change";
}

export type SubscriptionLookup =
  | { ok: true; snapshot: SubscriptionSnapshot }
  | { ok: false; reason: string };

export type AdminPriceItem = {
  position: number;
  service: string;
  label: string;
  unit: string;
  unitAmountCents: number;
};
export type AdminLastEvent = { type: string; outcome: string; occurredAt: string };
export type AdminSubscriptionRow = {
  orgId: string;
  contractId: string;
  offerName: string;
  offerCode: string;
  billingPeriod: string;
  items: AdminPriceItem[];
  providerSubscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  lastEvent: AdminLastEvent | null;
  divergence: AdminDivergence;
};
export type AdminEntitlement = {
  companyId: string | null;
  service: string;
  status: EntitlementStatus;
  reason: string;
  applied: boolean;
  updatedAt: string;
};
export type AdminReconciliation = {
  id: string;
  operatorId: string;
  reason: string;
  result: ReconciliationResult;
  source: ReconciliationSource;
  detail: string;
  createdAt: string;
};
export type AdminSubscriptionDetail = {
  orgId: string;
  contractId: string;
  offerName: string;
  offerCode: string;
  offerVersion: number;
  billingPeriod: string;
  currency: string;
  fictitious: boolean;
  termStart: string;
  termEnd: string | null;
  items: AdminPriceItem[];
  subscription: {
    providerSubscriptionId: string;
    providerCustomerId: string | null;
    status: SubscriptionStatus;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
    lastEventAt: string | null;
  } | null;
  entitlements: AdminEntitlement[];
  events: (AdminLastEvent & { detail: string })[];
  reconciliations: AdminReconciliation[];
  divergence: AdminDivergence;
};
export type ReconcileOutcome = {
  id: string;
  result: ReconciliationResult;
  source: ReconciliationSource;
  detail: string;
};

export const DIVERGENCE_LABELS: Record<AdminDivergence, string> = {
  none: "Sem divergência",
  entitlement_mismatch: "Direitos divergem do espelho",
  no_entitlements: "Sem direitos de uso gravados",
  never_synced: "Nunca sincronizada",
};

export const RECONCILIATION_RESULT_LABELS: Record<ReconciliationResult, string> = {
  no_change: "Nada a corrigir",
  corrected: "Corrigido",
  source_unavailable: "Fonte indisponível — reavaliado pelo espelho local",
};

export const RECONCILIATION_SOURCE_LABELS: Record<ReconciliationSource, string> = {
  provider: "Provedor",
  mirror: "Espelho local",
};
