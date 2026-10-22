import { z } from "zod";

export const billingProductSchema = z.enum(["pro", "pgr", "medicine"]);
export type BillingProduct = z.infer<typeof billingProductSchema>;
export const billingIntervalSchema = z.enum(["month", "year", "one_time"]);
export const billingStatusSchema = z.enum([
  "pending_payment",
  "requires_action",
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "canceled",
  "expired",
]);
export type BillingStatus = z.infer<typeof billingStatusSchema>;
export const billingReasonSchema = z.string().trim().min(3).max(1000);
export const amountMinorSchema = z.number().int().min(0).max(99_999_999);
export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(160)
  .regex(/^[a-zA-Z0-9_.:-]+$/);

export const billingPolicySchema = z
  .object({
    trialDays: z.literal(15).default(15),
    trialRequiresCard: z.literal(false).default(false),
    trialAllowsExport: z.literal(false).default(false),
    changeTiming: z.enum(["period_end", "immediate"]).default("period_end"),
    cancellationTiming: z.enum(["period_end", "immediate"]).default("period_end"),
    pastDueAccess: z
      .enum(["preserve_until_period_end", "suspend"])
      .default("preserve_until_period_end"),
    quoteMinutes: z.number().int().min(1).max(60).default(10),
  })
  .strict();
export type BillingPolicy = z.infer<typeof billingPolicySchema>;

export const billingPriceItemSchema = z
  .object({
    product: billingProductSchema,
    label: z.string().trim().min(1).max(150),
    amountMinor: amountMinorSchema,
  })
  .strict();
export type BillingPriceItem = z.infer<typeof billingPriceItemSchema>;

export const billingOfferSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9_-]+$/),
    name: z.string().trim().min(2).max(150),
    description: z.string().trim().max(3000).default(""),
    interval: billingIntervalSchema,
    currency: z.literal("BRL").default("BRL"),
    items: z.array(billingPriceItemSchema).min(1).max(3),
    benefits: z.array(z.string().trim().min(1).max(250)).max(30).default([]),
    limits: z
      .object({
        companies: z.number().int().positive().nullable(),
        employees: z.number().int().positive().nullable(),
      })
      .strict(),
    policy: billingPolicySchema,
    reason: billingReasonSchema,
  })
  .strict()
  .superRefine((offer, ctx) => {
    if (new Set(offer.items.map((i) => i.product)).size !== offer.items.length)
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "Discrimine cada produto uma única vez.",
      });
    if (offer.items.reduce((sum, i) => sum + i.amountMinor, 0) > 99_999_999)
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "Valor total acima do limite.",
      });
  });
export type BillingOfferInput = z.infer<typeof billingOfferSchema>;

export function totalMinor(items: readonly BillingPriceItem[]): number {
  return items.reduce((sum, item) => sum + amountMinorSchema.parse(item.amountMinor), 0);
}

export type SimulationEnvironment = {
  APP_ENV?: string;
  BILLING_MODE?: string;
  BILLING_MOCK_ENABLED?: string;
  VERCEL_ENV?: string;
  VERCEL_TARGET_ENV?: string;
};
export function isBillingSimulationEnabled(env: SimulationEnvironment): boolean {
  return (
    env.VERCEL_ENV !== "production" &&
    env.VERCEL_TARGET_ENV !== "production" &&
    ["local", "sandbox", "test"].includes(env.APP_ENV ?? "") &&
    env.BILLING_MODE === "mock" &&
    env.BILLING_MOCK_ENABLED === "true"
  );
}

export function billingActions(
  status: BillingStatus,
  cancelAtPeriodEnd: boolean,
): string[] {
  if (status === "active" || status === "trialing")
    return cancelAtPeriodEnd
      ? ["resume", "portal", "invoices"]
      : ["change", "cancel", "portal", "invoices"];
  if (status === "pending_payment" || status === "requires_action")
    return ["checkout", "invoices"];
  if (status === "past_due" || status === "unpaid")
    return ["portal", "invoices", "reconcile"];
  return ["checkout", "invoices"];
}

/** A normalized financial status never overrides an expired period. */
export function hasContractAccess(
  input: {
    status: BillingStatus;
    periodEnd: Date | null;
    trialEndsAt: Date | null;
    policy: BillingPolicy;
  },
  now: Date = new Date(),
): boolean {
  if (input.status === "trialing")
    return input.trialEndsAt !== null && input.trialEndsAt > now;
  if (input.status === "active") return input.periodEnd !== null && input.periodEnd > now;
  return (
    input.status === "past_due" &&
    input.policy.pastDueAccess === "preserve_until_period_end" &&
    input.periodEnd !== null &&
    input.periodEnd > now
  );
}

export const normalizedBillingEventSchema = z
  .object({
    eventId: z.string().trim().min(1).max(200),
    contractId: z.uuid(),
    revision: z.number().int().positive(),
    invoice: z
      .object({
        id: z.string().trim().min(1).max(200),
        amountMinor: amountMinorSchema,
        currency: z.literal("BRL"),
        status: z.enum(["open", "paid", "void"]),
      })
      .strict()
      .optional(),
    status: billingStatusSchema,
    periodStart: z.iso.datetime({ offset: true }),
    periodEnd: z.iso.datetime({ offset: true }),
    occurredAt: z.iso.datetime({ offset: true }),
    kind: z.enum([
      "payment_confirmed",
      "action_required",
      "payment_refused",
      "renewed",
      "payment_failed",
      "recovered",
      "canceled",
      "updated",
    ]),
  })
  .strict()
  .refine((v) => Date.parse(v.periodEnd) > Date.parse(v.periodStart), {
    path: ["periodEnd"],
    message: "Período inválido.",
  })
  .superRefine((event, ctx) => {
    const expected: Partial<Record<typeof event.kind, BillingStatus[]>> = {
      payment_confirmed: ["active"],
      renewed: ["active"],
      recovered: ["active"],
      action_required: ["requires_action"],
      payment_refused: ["unpaid"],
      payment_failed: ["past_due", "unpaid"],
      canceled: ["canceled"],
    };
    const statuses = expected[event.kind];
    if (statuses && !statuses.includes(event.status))
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "Estado incompatível com o evento financeiro.",
      });
    if (event.status === "active" && event.invoice?.status !== "paid")
      ctx.addIssue({
        code: "custom",
        path: ["invoice"],
        message: "Pagamento precisa de fatura confirmada com valor e moeda.",
      });
  });
export type NormalizedBillingEvent = z.infer<typeof normalizedBillingEventSchema>;

export type PaymentCheckout = {
  sessionId: string;
  checkoutUrl: string;
  expiresAt: string;
};
export type PaymentPortal = { sessionId: string; portalUrl: string; expiresAt: string };
export type PaymentInvoice = {
  id: string;
  contractId: string;
  amountMinor: number;
  currency: "BRL";
  status: "open" | "paid" | "void";
  createdAt: string;
};
export type PaymentChangeQuote = {
  quoteId: string;
  contractId: string;
  amountMinor: number;
  effectiveAt: string;
  expiresAt: string;
};
/** Provider inputs are resolved by the server; no raw card data or arbitrary URLs. */
export interface BillingGateway {
  readonly provider: string;
  readonly simulated: boolean;
  ensureCustomer(input: {
    tenantId: string;
    customerId: string;
  }): Promise<{ providerCustomerId: string }>;
  createCheckoutSession(input: {
    sessionId: string;
    contractId: string;
    customerId: string;
    items: BillingPriceItem[];
    interval: z.infer<typeof billingIntervalSchema>;
    expiresAt: string;
  }): Promise<PaymentCheckout>;
  createPortalSession(input: {
    sessionId: string;
    customerId: string;
    expiresAt: string;
  }): Promise<PaymentPortal>;
  getSubscription(contractId: string): Promise<NormalizedBillingEvent | null>;
  listInvoices(contractId: string): Promise<PaymentInvoice[]>;
  previewChange(input: PaymentChangeQuote): Promise<PaymentChangeQuote>;
  applyChange(quoteId: string): Promise<void>;
  cancelSubscription(contractId: string, effectiveAt: string): Promise<void>;
  resumeSubscription(contractId: string): Promise<void>;
  verifyAndNormalizeWebhook(
    rawBody: string,
    signature: string,
  ): Promise<NormalizedBillingEvent>;
}
