import "server-only";
import { and, eq, desc } from "drizzle-orm";
import * as s from "../../schema/billing";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import type { BillingOfferInput } from "@/shared/domains/billing/contracts";
import { scope, billingTransaction, audit } from "./shared";
export function createOfferVersion(ctx: TenantContext, data: BillingOfferInput) {
  return billingTransaction(ctx, async (tx) => {
    const [last] = await tx
      .select()
      .from(s.billingOffers)
      .where(
        and(scope(s.billingOffers, ctx.tenantId), eq(s.billingOffers.code, data.code)),
      )
      .orderBy(desc(s.billingOffers.version))
      .limit(1);
    const [row] = await tx
      .insert(s.billingOffers)
      .values({
        orgId: ctx.tenantId,
        code: data.code,
        version: (last?.version ?? 0) + 1,
        data,
        createdBy: ctx.userId,
      })
      .returning();
    await audit(tx, ctx, row.id, "offer.version_created", data.reason);
    return row;
  });
}
export function listBillingOffers(ctx: TenantContext, page: number) {
  return billingTransaction(ctx, (tx) =>
    tx
      .selectDistinctOn([s.billingOffers.code])
      .from(s.billingOffers)
      .where(scope(s.billingOffers, ctx.tenantId))
      .orderBy(s.billingOffers.code, desc(s.billingOffers.version))
      .limit(50)
      .offset((page - 1) * 50),
  );
}
