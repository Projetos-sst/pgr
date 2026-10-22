import "server-only";
import { eq, desc } from "drizzle-orm";
import * as s from "../../schema/billing";
import { companies } from "../../schema/companies";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { billingActions, hasContractAccess } from "@/shared/domains/billing/contracts";
import { scope, billingTransaction } from "./shared";
export function billingOverview(ctx: TenantContext, page = 1) {
  return billingTransaction(ctx, async (tx) => {
    const offers = await tx
      .select()
      .from(s.billingOffers)
      .where(scope(s.billingOffers, ctx.tenantId))
      .orderBy(desc(s.billingOffers.createdAt))
      .limit(100);
    const contracts = await tx
      .select()
      .from(s.billingContracts)
      .where(scope(s.billingContracts, ctx.tenantId))
      .orderBy(desc(s.billingContracts.createdAt))
      .limit(100);
    const invoices = await tx
      .select()
      .from(s.billingInvoices)
      .where(scope(s.billingInvoices, ctx.tenantId))
      .orderBy(desc(s.billingInvoices.createdAt), desc(s.billingInvoices.id))
      .limit(20)
      .offset((page - 1) * 20);
    const trials = await tx
      .select()
      .from(s.billingTrials)
      .where(scope(s.billingTrials, ctx.tenantId))
      .orderBy(desc(s.billingTrials.createdAt))
      .limit(100);
    const interests = await tx
      .select()
      .from(s.billingInterests)
      .where(scope(s.billingInterests, ctx.tenantId))
      .orderBy(desc(s.billingInterests.createdAt))
      .limit(100);
    const customers = await tx
      .select({
        id: s.billingCustomers.id,
        companyId: s.billingCustomers.companyId,
        name: s.billingCustomers.name,
      })
      .from(s.billingCustomers)
      .where(scope(s.billingCustomers, ctx.tenantId))
      .limit(100);
    const companyOptions = await tx
      .select({ id: companies.id, name: companies.razaoSocial })
      .from(companies)
      .where(eq(companies.orgId, ctx.tenantId))
      .orderBy(companies.razaoSocial)
      .limit(200);
    const history = await tx
      .select()
      .from(s.billingAudit)
      .where(scope(s.billingAudit, ctx.tenantId))
      .orderBy(desc(s.billingAudit.createdAt))
      .limit(100);
    return {
      simulated: true,
      companyOptions,
      history,
      offers: offers.filter((o, i, all) => all.findIndex((x) => x.code === o.code) === i),
      contracts: contracts.map((c) => ({
        ...c,
        availableActions: billingActions(c.status, c.cancelAtPeriodEnd),
        access: hasContractAccess({
          status: c.status,
          periodEnd: c.periodEnd,
          trialEndsAt: null,
          policy: c.snapshot.policy,
        }),
      })),
      invoices,
      invoicePage: page,
      trials,
      interests,
      customers,
    };
  });
}
