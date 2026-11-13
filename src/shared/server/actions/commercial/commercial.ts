"use server";

import { officeAction } from "@/shared/server/office-action";
import { getContractBilling } from "@/shared/server/commercial/billing-events-core";
import { startContractCheckout } from "@/shared/server/commercial/checkout-core";
import * as core from "@/shared/server/commercial/commercial-core";
import { getInvoice, listInvoices } from "@/shared/server/commercial/invoices-core";

export async function listCommercialOffersAction() {
  return officeAction("commercial.offer.list", (ctx) => core.listSellableOffers(ctx));
}

export async function listCommercialCustomersAction(filters: unknown = {}) {
  return officeAction("commercial.customer.list", (ctx) =>
    core.listCustomers(ctx, filters),
  );
}

export async function getCommercialCustomerAction(id: string) {
  return officeAction("commercial.customer.get", (ctx) => core.getCustomer(ctx, id));
}

export async function registerCommercialCustomerAction(input: unknown) {
  return officeAction(
    "commercial.customer.create",
    (ctx) => core.registerCustomer(ctx, input),
    { audit: true },
  );
}

export async function updateCommercialCustomerAction(id: string, input: unknown) {
  return officeAction(
    "commercial.customer.update",
    (ctx) => core.updateCustomer(ctx, id, input),
    { audit: true },
  );
}

export async function registerCommercialInterestAction(input: unknown) {
  return officeAction(
    "commercial.interest.create",
    (ctx) => core.registerInterest(ctx, input),
    { audit: true },
  );
}

export async function listCommercialInterestsAction(filters: unknown = {}) {
  return officeAction("commercial.interest.list", (ctx) =>
    core.listInterests(ctx, filters),
  );
}

export async function markCommercialInterestSeenAction(id: string) {
  return officeAction(
    "commercial.interest.seen",
    (ctx) => core.markInterestSeen(ctx, id),
    { audit: true },
  );
}

export async function listCommercialContractsAction(filters: unknown = {}) {
  return officeAction("commercial.contract.list", (ctx) =>
    core.listContracts(ctx, filters),
  );
}

export async function getCommercialContractAction(id: string) {
  return officeAction("commercial.contract.get", (ctx) => core.getContract(ctx, id));
}

export async function registerCommercialContractAction(input: unknown) {
  return officeAction(
    "commercial.contract.create",
    (ctx) => core.registerContract(ctx, input),
    { audit: true },
  );
}

export async function startCommercialCheckoutAction(contractId: string, input: unknown) {
  return officeAction(
    "commercial.checkout.create",
    (ctx) => startContractCheckout(ctx, contractId, input),
    { audit: true },
  );
}

export async function getCommercialBillingAction(contractId: string) {
  return officeAction("commercial.billing.get", (ctx) =>
    getContractBilling(ctx, contractId),
  );
}

export async function listCommercialInvoicesAction(filters: unknown = {}) {
  return officeAction("commercial.invoice.list", (ctx) => listInvoices(ctx, filters));
}

export async function getCommercialInvoiceAction(id: string) {
  return officeAction("commercial.invoice.get", (ctx) => getInvoice(ctx, id));
}
