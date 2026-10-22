"use server";
import { officeAction } from "@/shared/server/office-action";
import * as core from "@/shared/server/platform/billing-orders-core";
export async function createCommercialOrderAction(input: unknown) {
  return officeAction(
    "billing.order.create",
    (ctx) => core.createCommercialOrder(ctx, input),
    { audit: true },
  );
}
export async function getCommercialOrderAction(id: string) {
  return officeAction("billing.order.read", (ctx) => core.getCommercialOrder(ctx, id));
}
export async function getCommercialOrdersAction(page = 1) {
  return officeAction("billing.orders.read", (ctx) =>
    core.getCommercialOrders(ctx, page),
  );
}
export async function requirePurchasedServiceAction(input: unknown) {
  return officeAction("billing.order.authorize", (ctx) =>
    core.requirePurchasedService(ctx, input),
  );
}
