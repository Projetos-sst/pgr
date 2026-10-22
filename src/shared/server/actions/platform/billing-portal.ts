"use server";
import { officeAction } from "@/shared/server/office-action";
import {
  openCommercialPortal,
  getCommercialPaymentProfile,
  synchronizeMockPaymentProfile,
} from "@/shared/server/platform/billing-portal-core";
export async function openCommercialPortalAction(input: unknown) {
  return officeAction("billing.portal.open", (ctx) => openCommercialPortal(ctx, input), {
    audit: true,
  });
}
export async function synchronizeMockPaymentProfileAction(input: unknown) {
  return officeAction(
    "billing.payment_profile.synchronize",
    (ctx) => synchronizeMockPaymentProfile(ctx, input),
    { audit: true },
  );
}
export async function getCommercialPaymentProfileAction(customerId: string) {
  return officeAction("billing.payment_profile.read", (ctx) =>
    getCommercialPaymentProfile(ctx, customerId),
  );
}
