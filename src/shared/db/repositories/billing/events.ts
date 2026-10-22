import "server-only";
import { isDeepStrictEqual } from "node:util";
import { ValidationError } from "@/shared/errors/validation-error";
import { and, eq, desc, isNotNull, isNull, lte } from "drizzle-orm";
import * as s from "../../schema/billing";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  hasContractAccess,
  normalizedBillingEventSchema,
  totalMinor,
  type NormalizedBillingEvent,
} from "@/shared/domains/billing/contracts";
import { scope, conflict, billingTransaction, audit, contract, offer } from "./shared";
export function applyBillingEvent(ctx: TenantContext, raw: NormalizedBillingEvent) {
  const event = normalizedBillingEventSchema.parse(raw);
  return billingTransaction(ctx, async (tx) => {
    const row = await contract(tx, ctx, event.contractId);
    const [duplicate] = await tx
      .select()
      .from(s.billingEvents)
      .where(
        and(
          scope(s.billingEvents, ctx.tenantId),
          eq(s.billingEvents.providerEventId, event.eventId),
        ),
      );
    if (duplicate) {
      if (!isDeepStrictEqual(duplicate.payload, event))
        conflict("Identificador de evento reutilizado com outro conteúdo.");
      return { applied: false, duplicate: true };
    }
    const applied = event.revision > row.revision;
    await tx.insert(s.billingEvents).values({
      orgId: ctx.tenantId,
      contractId: row.id,
      providerEventId: event.eventId,
      payload: event,
      applied,
    });
    if (!applied) return { applied: false, duplicate: false };
    const periodStart = new Date(event.periodStart),
      periodEnd = new Date(event.periodEnd);
    let snapshot = row.snapshot,
      offerId = row.offerId;
    const [scheduled] = await tx
      .select()
      .from(s.billingQuotes)
      .where(
        and(
          scope(s.billingQuotes, ctx.tenantId),
          eq(s.billingQuotes.contractId, row.id),
          isNotNull(s.billingQuotes.confirmedAt),
          lte(s.billingQuotes.effectiveAt, periodStart),
        ),
      )
      .orderBy(desc(s.billingQuotes.createdAt))
      .limit(1);
    if (scheduled?.confirmedAt && scheduled.effectiveAt <= periodStart) {
      const next = await offer(tx, ctx, scheduled.offerId);
      snapshot = next.data;
      offerId = next.id;
    }
    const status =
      row.cancelAtPeriodEnd && row.periodEnd && periodStart >= row.periodEnd
        ? "canceled"
        : event.status;
    if (event.invoice && event.invoice.amountMinor !== totalMinor(snapshot.items))
      throw new ValidationError("Valor da fatura não corresponde aos itens contratados.");
    await tx
      .update(s.billingContracts)
      .set({
        status,
        revision: event.revision,
        periodStart,
        periodEnd,
        snapshot,
        offerId,
      })
      .where(eq(s.billingContracts.id, row.id));
    const customer = (
      await tx
        .select()
        .from(s.billingCustomers)
        .where(
          and(
            scope(s.billingCustomers, ctx.tenantId),
            eq(s.billingCustomers.id, row.customerId),
          ),
        )
    )[0];
    const active = hasContractAccess({
      status,
      periodEnd,
      trialEndsAt: null,
      policy: snapshot.policy,
    });
    // Grants are separate from manual company_modules: existing permissions remain intact.
    await tx
      .update(s.billingEntitlements)
      .set({ active: false })
      .where(
        and(
          scope(s.billingEntitlements, ctx.tenantId),
          eq(s.billingEntitlements.contractId, row.id),
        ),
      );
    for (const item of snapshot.items) {
      await tx
        .insert(s.billingEntitlements)
        .values({
          orgId: ctx.tenantId,
          contractId: row.id,
          companyId: customer.companyId,
          product: item.product,
          scope: snapshot.interval === "one_time" ? `order:${row.id}` : "subscription",
          validUntil: periodEnd,
          active,
        })
        .onConflictDoUpdate({
          target: [
            s.billingEntitlements.orgId,
            s.billingEntitlements.contractId,
            s.billingEntitlements.product,
          ],
          set: { active, validUntil: periodEnd },
        });
    }
    if (
      event.kind === "payment_confirmed" ||
      event.kind === "renewed" ||
      event.kind === "recovered"
    ) {
      await tx
        .update(s.billingTrials)
        .set({ convertedAt: new Date() })
        .where(
          and(
            scope(s.billingTrials, ctx.tenantId),
            eq(s.billingTrials.companyId, customer.companyId),
            isNull(s.billingTrials.convertedAt),
          ),
        );
    }
    if (event.invoice) {
      const [existing] = await tx
        .select()
        .from(s.billingInvoices)
        .where(
          and(
            scope(s.billingInvoices, ctx.tenantId),
            eq(s.billingInvoices.providerInvoiceId, event.invoice.id),
          ),
        );
      if (
        existing &&
        (existing.contractId !== row.id ||
          existing.amountMinor !== event.invoice.amountMinor ||
          (existing.periodStart && +existing.periodStart !== +periodStart) ||
          (existing.periodEnd && +existing.periodEnd !== +periodEnd))
      )
        conflict("Fatura reutilizada com outro contrato ou valor.");
      if (existing) {
        if (existing.status !== "paid" && event.invoice.status === "paid")
          await tx
            .update(s.billingInvoices)
            .set({ status: "paid" })
            .where(eq(s.billingInvoices.id, existing.id));
      } else
        await tx.insert(s.billingInvoices).values({
          orgId: ctx.tenantId,
          contractId: row.id,
          eventId: event.eventId,
          providerInvoiceId: event.invoice.id,
          periodStart,
          periodEnd,
          amountMinor: event.invoice.amountMinor,
          currency: event.invoice.currency,
          items: snapshot.items,
          status: event.invoice.status,
        });
    }
    await audit(
      tx,
      ctx,
      row.id,
      `event.${event.kind}`,
      `Simulação, revisão ${event.revision}.`,
    );
    return { applied: true, duplicate: false };
  });
}
