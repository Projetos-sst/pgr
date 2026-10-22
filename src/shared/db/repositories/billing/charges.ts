import "server-only";
import { and, eq, desc } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as s from "../../schema/billing";
import { scope, billingTransaction } from "./shared";
export function listCommercialCharges(
  ctx: TenantContext,
  page: number,
  companyId?: string,
) {
  return billingTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: s.billingInvoices.id,
        contractId: s.billingInvoices.contractId,
        companyId: s.billingCustomers.companyId,
        companyName: s.billingCustomers.name,
        items: s.billingInvoices.items,
        amountMinor: s.billingInvoices.amountMinor,
        currency: s.billingInvoices.currency,
        status: s.billingInvoices.status,
        periodStart: s.billingInvoices.periodStart,
        periodEnd: s.billingInvoices.periodEnd,
        createdAt: s.billingInvoices.createdAt,
      })
      .from(s.billingInvoices)
      .innerJoin(
        s.billingContracts,
        and(
          eq(s.billingContracts.id, s.billingInvoices.contractId),
          eq(s.billingContracts.orgId, s.billingInvoices.orgId),
        ),
      )
      .innerJoin(
        s.billingCustomers,
        and(
          eq(s.billingCustomers.id, s.billingContracts.customerId),
          eq(s.billingCustomers.orgId, s.billingContracts.orgId),
        ),
      )
      .where(
        and(
          scope(s.billingInvoices, ctx.tenantId),
          companyId ? eq(s.billingCustomers.companyId, companyId) : undefined,
        ),
      )
      .orderBy(desc(s.billingInvoices.createdAt), desc(s.billingInvoices.id))
      .limit(21)
      .offset((page - 1) * 20);
    return { rows: rows.slice(0, 20), page, hasMore: rows.length > 20, simulated: true };
  });
}
