import "server-only";

import { and, count, desc, eq, type SQL } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  oneOffOfferProblem,
  type OneOffOrderFilters,
  type OneOffOrderInput,
} from "@/shared/domains/commercial/one-off-order";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { resolvePageParams, type Paginated } from "@/shared/pagination";

import { commercialContracts, commercialOneOffOrders } from "../schema/commercial";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";
import {
  createContractIn,
  offerOnSale,
  type ContractClock,
} from "./commercial-contracts";
import { findOfficeCustomer } from "./commercial-customers";

const orders = commercialOneOffOrders;

const columns = {
  id: orders.id,
  contractId: orders.contractId,
  companyId: orders.companyId,
  status: orders.status,
  providerPaymentRef: orders.providerPaymentRef,
  paidAt: orders.paidAt,
  createdBy: orders.createdBy,
  createdAt: orders.createdAt,
  offerCode: commercialContracts.offerCode,
  offerName: commercialContracts.offerName,
};

const selectOrders = (tx: TenantTransaction) =>
  tx
    .select(columns)
    .from(orders)
    .innerJoin(
      commercialContracts,
      and(
        eq(commercialContracts.id, orders.contractId),
        eq(commercialContracts.orgId, orders.orgId),
      ),
    );

async function findOrder(tx: TenantTransaction, orgId: string, id: string) {
  const [row] = await selectOrders(tx).where(
    and(eq(orders.orgId, orgId), eq(orders.id, id)),
  );
  return row ?? null;
}
export type OneOffOrder = NonNullable<Awaited<ReturnType<typeof findOrder>>>;

async function requireOffice(tx: TenantTransaction, orgId: string) {
  const office = await findOfficeCustomer(tx, orgId);
  if (!office)
    throw new ValidationError("Cadastre o cliente do escritório antes de contratar.");
  return office;
}

async function requireOneOffOffer(
  tx: TenantTransaction,
  offerId: string,
  clock: ContractClock,
) {
  const offer = await offerOnSale(tx, offerId, clock);
  const problem = oneOffOfferProblem(offer);
  if (problem) throw new ValidationError(problem);
}

export function createOneOffOrder(
  ctx: TenantContext,
  input: OneOffOrderInput,
  clock: ContractClock,
): Promise<OneOffOrder> {
  return auditedTenantWrite(ctx.tenantId, "commercial.one_off_order.create", () =>
    withOrg(ctx.tenantId, async (tx) => {
      const office = await requireOffice(tx, ctx.tenantId);
      await requireOneOffOffer(tx, input.offerId, clock);
      const contract = await createContractIn(
        tx,
        ctx,
        {
          customerId: office.id,
          offerVersionId: input.offerId,
          companyIds: [input.companyId],
          termStart: clock.today,
          termEnd: null,
        },
        clock,
      );
      const [created] = await tx
        .insert(orders)
        .values({
          orgId: ctx.tenantId,
          contractId: contract.id,
          companyId: input.companyId,
          createdBy: ctx.userId,
        })
        .returning({ id: orders.id });
      const order = await findOrder(tx, ctx.tenantId, created.id);
      if (!order) throw new NotFoundError();
      return order;
    }),
  );
}

export function getOneOffOrder(ctx: TenantContext, id: string): Promise<OneOffOrder> {
  return withOrg(ctx.tenantId, async (tx) => {
    const order = await findOrder(tx, ctx.tenantId, id);
    if (!order) throw new NotFoundError();
    return order;
  });
}

export type OneOffOrderAccess = Pick<OneOffOrder, "id" | "companyId" | "status">;

export function getOneOffOrderAccess(
  ctx: TenantContext,
  id: string,
): Promise<OneOffOrderAccess> {
  return withOrg(ctx.tenantId, async (tx) => {
    const [row] = await tx
      .select({ id: orders.id, companyId: orders.companyId, status: orders.status })
      .from(orders)
      .where(and(eq(orders.orgId, ctx.tenantId), eq(orders.id, id)));
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function listOneOffOrders(
  ctx: TenantContext,
  filters: OneOffOrderFilters = {},
): Promise<Paginated<OneOffOrder>> {
  return withOrg(ctx.tenantId, async (tx) => {
    const { limit, offset } = resolvePageParams(filters);
    const conditions: SQL[] = [eq(orders.orgId, ctx.tenantId)];
    if (filters.companyId) conditions.push(eq(orders.companyId, filters.companyId));
    if (filters.status) conditions.push(eq(orders.status, filters.status));
    const where = and(...conditions);
    const rows = await selectOrders(tx)
      .where(where)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx.select({ total: count() }).from(orders).where(where);
    return { rows, total };
  });
}
