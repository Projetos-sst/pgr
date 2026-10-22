import "server-only";
import { and, eq } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { NotFoundError } from "@/shared/errors/not-found-error";
import * as s from "../../schema/billing";
import { scope, billingTransaction } from "./shared";
export function readCheckoutSession(ctx: TenantContext, id: string) {
  return billingTransaction(ctx, async (tx) => {
    const [r] = await tx
      .select({
        contractId: s.billingOperations.resultId,
        expiresAt: s.billingOperations.expiresAt,
      })
      .from(s.billingOperations)
      .where(
        and(
          scope(s.billingOperations, ctx.tenantId),
          eq(s.billingOperations.id, id),
          eq(s.billingOperations.kind, "checkout"),
        ),
      );
    if (!r || r.expiresAt <= new Date())
      throw new NotFoundError("Checkout inválido ou expirado. Consulte sua assinatura.");
    return { ...r, expiresAt: r.expiresAt.toISOString(), simulated: true };
  });
}
