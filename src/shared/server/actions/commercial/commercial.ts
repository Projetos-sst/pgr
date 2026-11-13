"use server";

import { officeAction } from "@/shared/server/office-action";
import * as core from "@/shared/server/commercial/commercial-core";

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
