"use server";
import { officeAction } from "@/shared/server/office-action";
import * as core from "@/shared/server/platform/billing-catalog-core";
export async function getBillingCatalogAction(page = 1) {
  return officeAction("billing.catalog.read", (ctx) => core.getBillingCatalog(ctx, page));
}
export async function createBillingOfferAction(input: unknown) {
  return officeAction(
    "billing.offer.create",
    (ctx) => core.createBillingOffer(ctx, input),
    { audit: true },
  );
}
export async function getBillingCustomersAction(page = 1) {
  return officeAction("billing.customers.read", (ctx) =>
    core.getBillingCustomers(ctx, page),
  );
}
export async function createBillingCustomerAction(input: unknown) {
  return officeAction(
    "billing.customer.create",
    (ctx) => core.createBillingCustomer(ctx, input),
    { audit: true },
  );
}
