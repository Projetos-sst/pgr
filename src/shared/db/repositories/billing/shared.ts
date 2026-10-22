import "server-only";
import { and, eq, sql, desc } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { withOrg, type TenantTransaction } from "../../with-org";
import * as s from "../../schema/billing";
import { companies } from "../../schema/companies";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { AppError } from "@/shared/errors/app-error";
export const scope = (
  table: {
    orgId: AnyPgColumn<{
      data: string;
    }>;
  },
  org: string,
) => eq(table.orgId, org);
export class BillingConflictError extends AppError {
  readonly code = "DUPLICATE";
  readonly status = 409;
}
export function conflict(message: string): never {
  throw new BillingConflictError(message);
}
export async function billingTransaction<T>(
  ctx: TenantContext,
  fn: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  if (ctx.role !== "owner")
    throw new ForbiddenError(
      "Somente o administrador pode consultar e alterar dados financeiros.",
    );
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor',${ctx.userId},true)`);
    // Serializes commercial mutations for one tenant; no cross-tenant contention.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`billing:${ctx.tenantId}`},0))`,
    );
    return fn(tx);
  });
}
export async function audit(
  tx: TenantTransaction,
  ctx: TenantContext,
  entityId: string,
  action: string,
  reason: string,
) {
  await tx
    .insert(s.billingAudit)
    .values({ orgId: ctx.tenantId, entityId, action, reason, createdBy: ctx.userId });
}
export async function contract(tx: TenantTransaction, ctx: TenantContext, id: string) {
  const [row] = await tx
    .select()
    .from(s.billingContracts)
    .where(and(scope(s.billingContracts, ctx.tenantId), eq(s.billingContracts.id, id)))
    .for("update");
  if (!row) throw new NotFoundError();
  return row;
}
export async function offer(tx: TenantTransaction, ctx: TenantContext, id: string) {
  const [row] = await tx
    .select()
    .from(s.billingOffers)
    .where(and(scope(s.billingOffers, ctx.tenantId), eq(s.billingOffers.id, id)));
  if (!row) throw new NotFoundError();
  return row;
}
export async function currentOffer(
  tx: TenantTransaction,
  ctx: TenantContext,
  id: string,
) {
  const selected = await offer(tx, ctx, id);
  const [latest] = await tx
    .select({ id: s.billingOffers.id })
    .from(s.billingOffers)
    .where(
      and(scope(s.billingOffers, ctx.tenantId), eq(s.billingOffers.code, selected.code)),
    )
    .orderBy(desc(s.billingOffers.version))
    .limit(1);
  if (latest.id !== selected.id)
    conflict("O preço foi atualizado. Consulte a oferta atual antes de contratar.");
  return selected;
}
export async function company(tx: TenantTransaction, ctx: TenantContext, id: string) {
  const [row] = await tx
    .select()
    .from(companies)
    .where(and(eq(companies.orgId, ctx.tenantId), eq(companies.id, id)));
  if (!row) throw new NotFoundError();
  return row;
}
