import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, desc, isNotNull, lte } from "drizzle-orm";
import * as s from "../../schema/billing";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  totalMinor,
  type NormalizedBillingEvent,
} from "@/shared/domains/billing/contracts";
import { scope, billingTransaction, audit, contract } from "./shared";
import { nextMockPeriod } from "@/shared/domains/billing/mock-period";
export function getProviderSnapshot(ctx: TenantContext, id: string) {
  return billingTransaction(ctx, async (tx) => {
    await contract(tx, ctx, id);
    const [row] = await tx
      .select()
      .from(s.billingProviderStates)
      .where(
        and(
          scope(s.billingProviderStates, ctx.tenantId),
          eq(s.billingProviderStates.contractId, id),
        ),
      );
    return row?.payload ?? null;
  });
}
export function auditReconciliation(ctx: TenantContext, id: string, reason: string) {
  return billingTransaction(ctx, async (tx) => {
    await contract(tx, ctx, id);
    await audit(tx, ctx, id, "provider.reconcile_requested", reason);
  });
}
export function simulateProviderEvent(ctx: TenantContext, id: string, scenario: string) {
  return billingTransaction(ctx, async (tx) => {
    const row = await contract(tx, ctx, id);
    const [provider] = await tx
      .select()
      .from(s.billingProviderStates)
      .where(
        and(
          scope(s.billingProviderStates, ctx.tenantId),
          eq(s.billingProviderStates.contractId, id),
        ),
      );
    if (scenario === "duplicate" && provider) return provider.payload;
    const now = new Date();
    let start =
      scenario === "renewal" && row.periodEnd ? row.periodEnd : (row.periodStart ?? now);
    let snapshot = row.snapshot;
    const [quote] = await tx
      .select({
        data: s.billingOffers.data,
        id: s.billingOffers.id,
        effectiveAt: s.billingQuotes.effectiveAt,
      })
      .from(s.billingQuotes)
      .innerJoin(
        s.billingOffers,
        and(
          eq(s.billingOffers.id, s.billingQuotes.offerId),
          eq(s.billingOffers.orgId, s.billingQuotes.orgId),
        ),
      )
      .where(
        and(
          scope(s.billingQuotes, ctx.tenantId),
          eq(s.billingQuotes.contractId, id),
          isNotNull(s.billingQuotes.confirmedAt),
          lte(s.billingQuotes.effectiveAt, scenario === "renewal" ? start : now),
        ),
      )
      .orderBy(desc(s.billingQuotes.expectedRevision), desc(s.billingQuotes.confirmedAt))
      .limit(1);
    if (quote && quote.id !== row.offerId) {
      snapshot = quote.data;
      if (quote.effectiveAt > start) start = quote.effectiveAt;
    }
    const end = nextMockPeriod(start, snapshot.interval);
    const states: Record<
      string,
      {
        status: NormalizedBillingEvent["status"];
        kind: NormalizedBillingEvent["kind"];
      }
    > = {
      success: { status: "active", kind: "payment_confirmed" },
      requires_action: { status: "requires_action", kind: "action_required" },
      refused: { status: "unpaid", kind: "payment_refused" },
      renewal: { status: "active", kind: "renewed" },
      late: { status: "past_due", kind: "payment_failed" },
      recovery: { status: "active", kind: "recovered" },
      cancel: { status: "canceled", kind: "canceled" },
    };
    const state = states[scenario] ?? states.success;
    const event: NormalizedBillingEvent = {
      eventId: `mock_${randomUUID()}`,
      contractId: id,
      revision: Math.max(row.revision, provider?.payload.revision ?? 0) + 1,
      ...state,
      periodStart: (scenario === "late" && row.periodStart
        ? row.periodStart
        : start
      ).toISOString(),
      periodEnd: (scenario === "late" && row.periodEnd
        ? row.periodEnd
        : end
      ).toISOString(),
      occurredAt: now.toISOString(),
      invoice:
        state.kind === "canceled"
          ? undefined
          : {
              id:
                (scenario === "recovery" || scenario === "success") &&
                snapshot === row.snapshot &&
                provider?.payload.invoice
                  ? provider.payload.invoice.id
                  : `mock_invoice_${randomUUID()}`,
              amountMinor: totalMinor(snapshot.items),
              currency: "BRL",
              status: state.status === "active" ? "paid" : "open",
            },
    };
    if (scenario === "out_of_order")
      return {
        ...event,
        revision: Math.max(1, row.revision - 1),
        status: "unpaid",
        kind: "payment_refused",
      };
    await tx
      .insert(s.billingProviderStates)
      .values({ orgId: ctx.tenantId, contractId: id, payload: event })
      .onConflictDoUpdate({
        target: [s.billingProviderStates.orgId, s.billingProviderStates.contractId],
        set: { payload: event },
      });
    await audit(tx, ctx, id, "simulation.created", `Cenário simulado: ${scenario}.`);
    return event;
  });
}
