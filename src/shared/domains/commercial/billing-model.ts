import { z } from "zod";

import type { CommercialService, CommercialUnit } from "./offer";

export const BILLING_PROVIDER = "stripe";
export type BillingProvider = typeof BILLING_PROVIDER;

export const checkoutStatusSchema = z.enum(["open", "completed", "expired"]);
export type CheckoutStatus = z.infer<typeof checkoutStatusSchema>;

export const subscriptionStatusSchema = z.enum([
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "canceled",
  "paused",
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const billingEventOutcomeSchema = z.enum(["applied", "stale", "ignored"]);
export type BillingEventOutcome = z.infer<typeof billingEventOutcomeSchema>;

export const entitlementServiceSchema = z.enum(["pgr", "medicine", "pro"]);
export type EntitlementService = z.infer<typeof entitlementServiceSchema>;

export type EntitlementTarget = { companyId: string | null; service: EntitlementService };

export const entitlementStatusSchema = z.enum(["active", "inactive"]);
export type EntitlementStatus = z.infer<typeof entitlementStatusSchema>;

export const invoiceStatusSchema = z.enum(["open", "paid", "void", "uncollectible"]);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export const invoiceItemServiceSchema = z.enum([
  "pgr",
  "medicine",
  "pro",
  "one_off",
  "unclassified",
]);
export type InvoiceItemService = z.infer<typeof invoiceItemServiceSchema>;

export type CommercialItem = {
  position: number;
  service: CommercialService;
  label: string;
  unit: CommercialUnit;
  unitAmountCents: number;
};
