import "server-only";

import { and, count, desc, eq, inArray, type SQL } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { totalsByService } from "@/shared/domains/commercial/invoice";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { resolvePageParams, type PageParams } from "@/shared/pagination";

import { billingInvoiceItems, billingInvoices } from "../schema/billing";
import { withOrg, type TenantTransaction } from "../with-org";

const invoices = billingInvoices;
const items = billingInvoiceItems;

export type InvoiceFilters = PageParams & { contractId?: string };

const header = {
  id: invoices.id,
  contractId: invoices.contractId,
  status: invoices.status,
  currency: invoices.currency,
  totalCents: invoices.totalCents,
  dueAt: invoices.dueAt,
  paidAt: invoices.paidAt,
  periodStart: invoices.periodStart,
  periodEnd: invoices.periodEnd,
  createdAt: invoices.createdAt,
};

const itemsOf = (tx: TenantTransaction, orgId: string, invoiceIds: string[]) =>
  tx
    .select({
      invoiceId: items.invoiceId,
      position: items.position,
      service: items.service,
      label: items.label,
      quantity: items.quantity,
      amountCents: items.amountCents,
    })
    .from(items)
    .where(and(eq(items.orgId, orgId), inArray(items.invoiceId, invoiceIds)))
    .orderBy(items.invoiceId, items.position);

export function listInvoices(ctx: TenantContext, filters: InvoiceFilters = {}) {
  return withOrg(ctx.tenantId, async (tx) => {
    const { limit, offset } = resolvePageParams(filters);
    const conditions: SQL[] = [eq(invoices.orgId, ctx.tenantId)];
    if (filters.contractId) conditions.push(eq(invoices.contractId, filters.contractId));
    const where = and(...conditions);
    const page = await tx
      .select(header)
      .from(invoices)
      .where(where)
      .orderBy(desc(invoices.createdAt), desc(invoices.id))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx.select({ total: count() }).from(invoices).where(where);
    const lines = await itemsOf(
      tx,
      ctx.tenantId,
      page.map((invoice) => invoice.id),
    );
    const rows = page.map((invoice) => ({
      ...invoice,
      totalsByService: totalsByService(
        lines.filter((line) => line.invoiceId === invoice.id),
      ),
    }));
    return { rows, total };
  });
}

export function getInvoice(ctx: TenantContext, id: string) {
  return withOrg(ctx.tenantId, async (tx) => {
    const [invoice] = await tx
      .select(header)
      .from(invoices)
      .where(and(eq(invoices.orgId, ctx.tenantId), eq(invoices.id, id)));
    if (!invoice) throw new NotFoundError();
    const lines = await itemsOf(tx, ctx.tenantId, [id]);
    return {
      ...invoice,
      totalsByService: totalsByService(lines),
      items: lines.map(({ invoiceId: _invoice, ...line }) => line),
    };
  });
}
