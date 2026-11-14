import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { todayInSaoPaulo } from "@/shared/dates";
import * as ordersRepo from "@/shared/db/repositories/commercial-one-off-orders";
import {
  isOneOffPaid,
  oneOffCovers,
  oneOffOrderFiltersSchema,
  oneOffOrderIdSchema,
  oneOffOrderInputSchema,
} from "@/shared/domains/commercial/one-off-order";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { PaymentRequiredError } from "@/shared/errors/payment-required-error";

import { requireFinancialOwner, requireOfficeStaffRole } from "./commercial-core";

const companyIdSchema = requiredUuid("Empresa inválida.");
const CONSULT_MESSAGE =
  "Apenas a equipe do escritório consulta a autorização do pedido avulso.";

export async function createOneOffOrder(ctx: TenantContext, input: unknown) {
  const env = requireFinancialOwner(ctx);
  return ordersRepo.createOneOffOrder(ctx, oneOffOrderInputSchema.parse(input), {
    today: todayInSaoPaulo(),
    env,
  });
}

export async function listOneOffOrders(ctx: TenantContext, filters: unknown) {
  requireFinancialOwner(ctx);
  return ordersRepo.listOneOffOrders(ctx, oneOffOrderFiltersSchema.parse(filters));
}

export async function getOneOffOrder(ctx: TenantContext, id: string) {
  requireFinancialOwner(ctx);
  return ordersRepo.getOneOffOrder(ctx, oneOffOrderIdSchema.parse(id));
}

export async function getOneOffAuthorization(
  ctx: TenantContext,
  id: string,
  companyId?: string,
) {
  requireOfficeStaffRole(ctx, CONSULT_MESSAGE);
  const order = await ordersRepo.getOneOffOrderAccess(ctx, oneOffOrderIdSchema.parse(id));
  return {
    orderId: order.id,
    companyId: order.companyId,
    status: order.status,
    purchased:
      companyId === undefined
        ? isOneOffPaid(order)
        : oneOffCovers(order, companyIdSchema.parse(companyId)),
  };
}

export async function requirePurchasedOneOff(
  ctx: TenantContext,
  orderId: string,
  companyId: string,
) {
  requireOfficeStaffRole(ctx, CONSULT_MESSAGE);
  const order = await ordersRepo.getOneOffOrderAccess(
    ctx,
    oneOffOrderIdSchema.parse(orderId),
  );
  if (!oneOffCovers(order, companyIdSchema.parse(companyId)))
    throw new PaymentRequiredError();
  return order;
}

export async function isOneOffPurchased(
  ctx: TenantContext,
  orderId: string,
  companyId: string,
): Promise<boolean> {
  requireOfficeStaffRole(ctx, CONSULT_MESSAGE);
  const order = await ordersRepo.getOneOffOrderAccess(
    ctx,
    oneOffOrderIdSchema.parse(orderId),
  );
  return oneOffCovers(order, companyIdSchema.parse(companyId));
}
