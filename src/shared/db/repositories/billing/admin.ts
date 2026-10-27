import "server-only";
import { and, eq, desc, ilike, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import type { BillingAdminFilter } from "@/shared/domains/billing/admin";
import * as s from "../../schema/billing";
import { scope, billingTransaction, contract } from "./shared";
export function listAdminSubscriptions(ctx: TenantContext, f: BillingAdminFilter) {
  return billingTransaction(ctx, async (tx) => {
    const c = s.billingContracts,
      customer = s.billingCustomers;
    const rows = await tx
      .select({
        id: c.id,
        companyId: customer.companyId,
        companyName: customer.name,
        plan: c.snapshot,
        status: c.status,
        periodEnd: c.periodEnd,
        createdAt: c.createdAt,
      })
      .from(c)
      .innerJoin(
        customer,
        and(eq(customer.id, c.customerId), eq(customer.orgId, c.orgId)),
      )
      .where(
        and(
          scope(c, ctx.tenantId),
          f.companyId ? eq(customer.companyId, f.companyId) : undefined,
          f.search
            ? ilike(customer.name, "%" + f.search.replace(/[%_\\]/g, "\\$&") + "%")
            : undefined,
          f.plan ? sql`${c.snapshot}->>'code' = ${f.plan}` : undefined,
          f.product
            ? sql`${c.snapshot}->'items' @> ${JSON.stringify([{ product: f.product }])}::jsonb`
            : undefined,
          f.status ? eq(c.status, f.status) : undefined,
          f.from ? sql`${c.createdAt} >= ${f.from}::timestamptz` : undefined,
          f.to ? sql`${c.createdAt} <= ${f.to}::timestamptz` : undefined,
        ),
      )
      .orderBy(desc(c.createdAt), desc(c.id))
      .limit(21)
      .offset((f.page - 1) * 20);
    return {
      rows: rows.slice(0, 20),
      page: f.page,
      hasMore: rows.length > 20,
      simulated: true,
    };
  });
}
export function getAdminSubscription(ctx: TenantContext, id: string) {
  return billingTransaction(ctx, async (tx) => {
    const row = await contract(tx, ctx, id);
    const [customer] = await tx
      .select({
        id: s.billingCustomers.id,
        companyId: s.billingCustomers.companyId,
        name: s.billingCustomers.name,
      })
      .from(s.billingCustomers)
      .where(
        and(
          scope(s.billingCustomers, ctx.tenantId),
          eq(s.billingCustomers.id, row.customerId),
        ),
      );
    const events = await tx
      .select({
        id: s.billingEvents.providerEventId,
        applied: s.billingEvents.applied,
        createdAt: s.billingEvents.createdAt,
      })
      .from(s.billingEvents)
      .where(
        and(scope(s.billingEvents, ctx.tenantId), eq(s.billingEvents.contractId, id)),
      )
      .orderBy(desc(s.billingEvents.createdAt))
      .limit(50);
    const history = await tx
      .select({
        action: s.billingAudit.action,
        reason: s.billingAudit.reason,
        actor: s.billingAudit.createdBy,
        at: s.billingAudit.createdAt,
      })
      .from(s.billingAudit)
      .where(and(scope(s.billingAudit, ctx.tenantId), eq(s.billingAudit.entityId, id)))
      .orderBy(desc(s.billingAudit.createdAt))
      .limit(50);
    const [provider] = await tx
      .select({ payload: s.billingProviderStates.payload })
      .from(s.billingProviderStates)
      .where(
        and(
          scope(s.billingProviderStates, ctx.tenantId),
          eq(s.billingProviderStates.contractId, id),
        ),
      );
    return {
      contract: row,
      customer,
      events,
      history,
      synchronization: {
        localRevision: row.revision,
        providerRevision: provider?.payload.revision ?? null,
        inSync: provider ? provider.payload.revision === row.revision : null,
      },
      historyLimit: 50,
      simulated: true,
    };
  });
}
