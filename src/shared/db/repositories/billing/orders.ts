import "server-only";
import { and, eq, desc, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { hasContractAccess } from "@/shared/domains/billing/contracts";
import { withOrg } from "../../with-org";
import * as s from "../../schema/billing";
import { scope, billingTransaction, offer } from "./shared";
export function assertOneOffOffer(ctx: TenantContext, id: string) {
  return billingTransaction(ctx, async (tx) => {
    const selected = await offer(tx, ctx, id);
    if (
      selected.data.interval !== "one_time" ||
      selected.data.items.some((i) => i.product === "pro")
    )
      throw new ForbiddenError("Selecione uma oferta avulsa de PGR ou Medicina.");
  });
}
export function getOneOffOrder(ctx: TenantContext, id: string) {
  return billingTransaction(ctx, async (tx) => {
    const [row] = await tx
      .select({
        contract: s.billingContracts,
        companyId: s.billingCustomers.companyId,
        companyName: s.billingCustomers.name,
      })
      .from(s.billingContracts)
      .innerJoin(
        s.billingCustomers,
        and(
          eq(s.billingCustomers.id, s.billingContracts.customerId),
          eq(s.billingCustomers.orgId, s.billingContracts.orgId),
        ),
      )
      .where(and(scope(s.billingContracts, ctx.tenantId), eq(s.billingContracts.id, id)));
    if (!row || row.contract.snapshot.interval !== "one_time") throw new NotFoundError();
    const grants = await tx
      .select()
      .from(s.billingEntitlements)
      .where(
        and(
          scope(s.billingEntitlements, ctx.tenantId),
          eq(s.billingEntitlements.contractId, id),
        ),
      );
    const access = hasContractAccess({
      status: row.contract.status,
      periodEnd: row.contract.periodEnd,
      trialEndsAt: null,
      policy: row.contract.snapshot.policy,
    });
    return {
      id,
      companyId: row.companyId,
      companyName: row.companyName,
      items: row.contract.snapshot.items,
      status: row.contract.status,
      availableProducts: access
        ? grants
            .filter(
              (g) =>
                g.active &&
                g.scope === `order:${id}` &&
                g.validUntil &&
                g.validUntil > new Date(),
            )
            .map((g) => g.product)
        : [],
      validUntil: row.contract.periodEnd,
      createdAt: row.contract.createdAt,
      simulated: true,
    };
  });
}
export function listOneOffOrders(ctx: TenantContext, page: number) {
  return billingTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: s.billingContracts.id,
        customerId: s.billingContracts.customerId,
        status: s.billingContracts.status,
        createdAt: s.billingContracts.createdAt,
      })
      .from(s.billingContracts)
      .where(
        and(
          scope(s.billingContracts, ctx.tenantId),
          sql`${s.billingContracts.snapshot}->>'interval'='one_time'`,
        ),
      )
      .orderBy(desc(s.billingContracts.createdAt), desc(s.billingContracts.id))
      .limit(21)
      .offset((page - 1) * 20);
    return { rows: rows.slice(0, 20), page, hasMore: rows.length > 20, simulated: true };
  });
}
/** Only checks commercial eligibility. Existing technical/professional authorization is still required. */
export async function purchasedServiceAllowed(
  ctx: TenantContext,
  input: { orderId: string; companyId: string; product: "pgr" | "medicine" },
) {
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor',${ctx.userId},true)`);
    const rows = await tx.execute<{ allowed: boolean }>(
      sql`select public.billing_order_service_allowed(${ctx.tenantId},${input.orderId}::uuid,${input.companyId}::uuid,${input.product}) as allowed`,
    );
    return rows[0]?.allowed === true;
  });
}
