import "server-only";
import { and, eq } from "drizzle-orm";
import * as s from "../../schema/billing";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import { NotFoundError } from "@/shared/errors/not-found-error";
import {
  billingActions,
  totalMinor,
  hasContractAccess,
} from "@/shared/domains/billing/contracts";
import {
  scope,
  conflict,
  billingTransaction,
  audit,
  contract,
  currentOffer,
} from "./shared";
export function previewBillingChange(
  ctx: TenantContext,
  input: {
    contractId: string;
    priceId: string;
  },
) {
  return billingTransaction(ctx, async (tx) => {
    const row = await contract(tx, ctx, input.contractId),
      selected = await currentOffer(tx, ctx, input.priceId);
    if (
      !billingActions(row.status, row.cancelAtPeriodEnd).includes("change") ||
      row.snapshot.interval === "one_time" ||
      selected.data.interval === "one_time"
    )
      throw new ForbiddenError("Alteração indisponível para este contrato.");
    const now = new Date();
    const effectiveAt =
      selected.data.policy.changeTiming === "immediate" ? now : row.periodEnd;
    if (!effectiveAt || effectiveAt < now)
      conflict("Reconcilie o período da assinatura antes de alterar.");
    const [quote] = await tx
      .insert(s.billingQuotes)
      .values({
        orgId: ctx.tenantId,
        contractId: row.id,
        offerId: selected.id,
        expectedRevision: row.revision,
        amountMinor: totalMinor(selected.data.items),
        effectiveAt,
        expiresAt: new Date(now.getTime() + selected.data.policy.quoteMinutes * 60000),
        createdBy: ctx.userId,
      })
      .returning();
    return {
      ...quote,
      items: selected.data.items,
      policy: selected.data.policy,
      simulated: true,
    };
  });
}
export function confirmBillingChange(
  ctx: TenantContext,
  quoteId: string,
  reason: string,
) {
  return billingTransaction(ctx, async (tx) => {
    const [quote] = await tx
      .select()
      .from(s.billingQuotes)
      .where(and(scope(s.billingQuotes, ctx.tenantId), eq(s.billingQuotes.id, quoteId)));
    if (!quote) throw new NotFoundError();
    const row = await contract(tx, ctx, quote.contractId);
    if (quote.confirmedAt) return { scheduled: true, effectiveAt: quote.effectiveAt };
    if (!billingActions(row.status, row.cancelAtPeriodEnd).includes("change"))
      throw new ForbiddenError("A assinatura não aceita mudança neste estado.");
    if (quote.expiresAt <= new Date() || quote.expectedRevision !== row.revision)
      conflict("Cotação expirada ou assinatura alterada. Gere uma nova prévia.");
    // Immediate changes still await a confirmed provider event. Confirmation alone never grants access.
    await tx
      .update(s.billingContracts)
      .set({ revision: row.revision + 1 })
      .where(eq(s.billingContracts.id, row.id));
    await tx
      .update(s.billingQuotes)
      .set({ confirmedAt: new Date() })
      .where(eq(s.billingQuotes.id, quote.id));
    await audit(tx, ctx, row.id, "change.confirmed", reason);
    return { scheduled: true, effectiveAt: quote.effectiveAt };
  });
}
export function setBillingCancellation(
  ctx: TenantContext,
  id: string,
  cancel: boolean,
  reason: string,
) {
  return billingTransaction(ctx, async (tx) => {
    const row = await contract(tx, ctx, id);
    if (row.snapshot.interval === "one_time")
      throw new ForbiddenError("Operação indisponível para pedidos avulsos.");
    if (cancel && (row.status === "canceled" || row.cancelAtPeriodEnd))
      return { accepted: true, duplicate: true };
    const access = hasContractAccess({
      status: row.status,
      periodEnd: row.periodEnd,
      trialEndsAt: null,
      policy: row.snapshot.policy,
    });
    if (!cancel && !row.cancelAtPeriodEnd && row.status === "active" && access)
      return { accepted: true, duplicate: true };
    if (
      !cancel &&
      (!row.periodEnd ||
        row.periodEnd <= new Date() ||
        row.status === "canceled" ||
        row.status === "expired")
    )
      throw new ForbiddenError("O período encerrou. Inicie uma nova contratação.");
    if (
      !billingActions(row.status, row.cancelAtPeriodEnd).includes(
        cancel ? "cancel" : "resume",
      )
    )
      throw new ForbiddenError("Operação indisponível para este contrato.");
    if (cancel && (row.snapshot.policy.cancellationTiming === "immediate" || !access)) {
      await tx
        .update(s.billingContracts)
        .set({ status: "canceled", cancelAtPeriodEnd: false, revision: row.revision + 1 })
        .where(eq(s.billingContracts.id, id));
      await tx
        .update(s.billingEntitlements)
        .set({ active: false })
        .where(
          and(
            scope(s.billingEntitlements, ctx.tenantId),
            eq(s.billingEntitlements.contractId, id),
          ),
        );
    } else
      await tx
        .update(s.billingContracts)
        .set({ cancelAtPeriodEnd: cancel, revision: row.revision + 1 })
        .where(eq(s.billingContracts.id, id));
    await audit(tx, ctx, id, cancel ? "cancel.requested" : "cancel.resumed", reason);
    return { accepted: true };
  });
}
