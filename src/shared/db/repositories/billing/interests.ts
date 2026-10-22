import "server-only";
import { and, eq, desc, isNull, isNotNull } from "drizzle-orm";
import { companies } from "../../schema/companies";
import * as s from "../../schema/billing";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { scope, billingTransaction, audit } from "./shared";
export function registerBillingInterest(
  ctx: TenantContext,
  input: {
    trialId: string;
    interest: string;
    message: string;
  },
) {
  return billingTransaction(ctx, async (tx) => {
    const [trial] = await tx
      .select()
      .from(s.billingTrials)
      .where(
        and(scope(s.billingTrials, ctx.tenantId), eq(s.billingTrials.id, input.trialId)),
      );
    if (!trial) throw new NotFoundError();
    const [created] = await tx
      .insert(s.billingInterests)
      .values({ orgId: ctx.tenantId, ...input, createdBy: ctx.userId })
      .onConflictDoNothing()
      .returning();
    if (created)
      await audit(
        tx,
        ctx,
        created.id,
        "interest.registered",
        "Alerta interno de interesse explícito; nenhum envio externo.",
      );
    return { registered: true, duplicate: !created };
  });
}
export function listBillingInterests(
  ctx: TenantContext,
  input: { page: number; status?: "pending" | "acknowledged"; companyId?: string },
) {
  return billingTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: s.billingInterests.id,
        trialId: s.billingInterests.trialId,
        companyId: s.billingTrials.companyId,
        companyName: companies.razaoSocial,
        interest: s.billingInterests.interest,
        message: s.billingInterests.message,
        createdAt: s.billingInterests.createdAt,
        acknowledgedAt: s.billingInterests.acknowledgedAt,
        trialEndsAt: s.billingTrials.endsAt,
      })
      .from(s.billingInterests)
      .innerJoin(
        s.billingTrials,
        and(
          eq(s.billingTrials.id, s.billingInterests.trialId),
          eq(s.billingTrials.orgId, s.billingInterests.orgId),
        ),
      )
      .innerJoin(
        companies,
        and(
          eq(companies.id, s.billingTrials.companyId),
          eq(companies.orgId, s.billingTrials.orgId),
        ),
      )
      .where(
        and(
          scope(s.billingInterests, ctx.tenantId),
          input.companyId ? eq(s.billingTrials.companyId, input.companyId) : undefined,
          input.status === "pending"
            ? isNull(s.billingInterests.acknowledgedAt)
            : input.status === "acknowledged"
              ? isNotNull(s.billingInterests.acknowledgedAt)
              : undefined,
        ),
      )
      .orderBy(desc(s.billingInterests.createdAt), desc(s.billingInterests.id))
      .limit(21)
      .offset((input.page - 1) * 20);
    return {
      rows: rows.slice(0, 20),
      page: input.page,
      hasMore: rows.length > 20,
      channel: "inbox" as const,
      simulated: true,
    };
  });
}
export function acknowledgeBillingInterest(
  ctx: TenantContext,
  id: string,
  reason: string,
) {
  return billingTransaction(ctx, async (tx) => {
    const [row] = await tx
      .select()
      .from(s.billingInterests)
      .where(and(scope(s.billingInterests, ctx.tenantId), eq(s.billingInterests.id, id)));
    if (!row) throw new NotFoundError();
    if (row.acknowledgedAt) return { acknowledged: true, duplicate: true };
    await tx
      .update(s.billingInterests)
      .set({ acknowledgedAt: new Date() })
      .where(eq(s.billingInterests.id, id));
    await audit(tx, ctx, id, "interest.acknowledged", reason);
    return { acknowledged: true, duplicate: false };
  });
}
