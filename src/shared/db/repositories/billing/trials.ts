import "server-only";
import { and, eq } from "drizzle-orm";
import * as s from "../../schema/billing";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { scope, billingTransaction, audit, company } from "./shared";
export function startBillingTrial(ctx: TenantContext, companyId: string) {
  return billingTransaction(ctx, async (tx) => {
    await company(tx, ctx, companyId);
    const [previous] = await tx
      .select()
      .from(s.billingTrials)
      .where(
        and(
          scope(s.billingTrials, ctx.tenantId),
          eq(s.billingTrials.companyId, companyId),
        ),
      );
    if (previous) return previous;
    const startedAt = new Date(),
      endsAt = new Date(startedAt.getTime() + 15 * 86400000);
    const [row] = await tx
      .insert(s.billingTrials)
      .values({
        orgId: ctx.tenantId,
        companyId,
        startedAt,
        endsAt,
        createdBy: ctx.userId,
      })
      .returning();
    await audit(
      tx,
      ctx,
      row.id,
      "trial.started",
      "Teste simulado de 15 dias, sem impressão ou exportação.",
    );
    return row;
  });
}
export function getBillingTrial(ctx: TenantContext, companyId: string) {
  return billingTransaction(ctx, async (tx) => {
    await company(tx, ctx, companyId);
    const [row] = await tx
      .select()
      .from(s.billingTrials)
      .where(
        and(
          scope(s.billingTrials, ctx.tenantId),
          eq(s.billingTrials.companyId, companyId),
        ),
      );
    return row ?? null;
  });
}
