import "server-only";

import { and, count, desc, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import type {
  InterestFilters,
  InterestInput,
  InterestService,
} from "@/shared/domains/commercial/interest";
import { DuplicateError } from "@/shared/errors/duplicate-error";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { resolvePageParams, type Paginated } from "@/shared/pagination";

import { commercialInterests } from "../schema/commercial";
import { companies } from "../schema/companies";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

const interests = commercialInterests;

const columns = {
  id: interests.id,
  companyId: interests.companyId,
  service: interests.service,
  message: interests.message,
  createdBy: interests.createdBy,
  createdAt: interests.createdAt,
  seenAt: interests.seenAt,
  seenBy: interests.seenBy,
};

export type CommercialInterest = {
  id: string;
  companyId: string;
  service: InterestService;
  message: string | null;
  createdBy: string;
  createdAt: Date;
  seenAt: Date | null;
  seenBy: string | null;
};

export type RegisteredInterest = { interest: CommercialInterest; created: boolean };

async function assertCompanyVisible(tx: TenantTransaction, orgId: string, id: string) {
  const [company] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.orgId, orgId), eq(companies.id, id)));
  if (!company) throw new ReferenceNotFoundError("Empresa inexistente neste escritório.");
}

async function findOpenInterest(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
  service: InterestService,
): Promise<CommercialInterest | null> {
  const [row] = await tx
    .select(columns)
    .from(interests)
    .where(
      and(
        eq(interests.orgId, orgId),
        eq(interests.companyId, companyId),
        eq(interests.service, service),
        isNull(interests.seenAt),
      ),
    );
  return row ?? null;
}

async function requireInterest(
  tx: TenantTransaction,
  orgId: string,
  id: string,
): Promise<CommercialInterest> {
  const [row] = await tx
    .select(columns)
    .from(interests)
    .where(and(eq(interests.orgId, orgId), eq(interests.id, id)));
  if (!row) throw new NotFoundError();
  return row;
}

async function insertIfAbsent(
  tx: TenantTransaction,
  ctx: TenantContext,
  input: InterestInput,
): Promise<boolean> {
  const inserted = await tx
    .insert(interests)
    .values({
      orgId: ctx.tenantId,
      companyId: input.companyId,
      service: input.service,
      message: input.message ?? null,
      createdBy: ctx.userId,
    })
    .onConflictDoNothing({
      target: [interests.orgId, interests.companyId, interests.service],
      where: sql`seen_at is null`,
    })
    .returning({ id: interests.id });
  return inserted.length > 0;
}

export function registerInterest(
  ctx: TenantContext,
  input: InterestInput,
): Promise<RegisteredInterest> {
  return auditedTenantWrite(ctx.tenantId, "commercial.interest.create", () =>
    withOrg(ctx.tenantId, async (tx) => {
      await assertCompanyVisible(tx, ctx.tenantId, input.companyId);
      const created = await insertIfAbsent(tx, ctx, input);
      const interest = await findOpenInterest(
        tx,
        ctx.tenantId,
        input.companyId,
        input.service,
      );
      if (!interest)
        throw new DuplicateError(
          "O interesse mudou durante o registro. Tente novamente.",
        );
      return { interest, created };
    }),
  );
}

export function listInterests(
  ctx: TenantContext,
  filters: InterestFilters = {},
): Promise<Paginated<CommercialInterest>> {
  return withOrg(ctx.tenantId, async (tx) => {
    const { limit, offset } = resolvePageParams(filters);
    const conditions: SQL[] = [eq(interests.orgId, ctx.tenantId)];
    if (filters.companyId) conditions.push(eq(interests.companyId, filters.companyId));
    if (filters.status === "open") conditions.push(isNull(interests.seenAt));
    if (filters.status === "seen") conditions.push(isNotNull(interests.seenAt));
    const where = and(...conditions);
    const rows = await tx
      .select(columns)
      .from(interests)
      .where(where)
      .orderBy(desc(interests.createdAt), desc(interests.id))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx.select({ total: count() }).from(interests).where(where);
    return { rows, total };
  });
}

export function markInterestSeen(
  ctx: TenantContext,
  id: string,
): Promise<CommercialInterest> {
  return auditedTenantWrite(ctx.tenantId, "commercial.interest.seen", () =>
    withOrg(ctx.tenantId, async (tx) => {
      await requireInterest(tx, ctx.tenantId, id);
      await tx
        .update(interests)
        .set({ seenAt: sql`now()`, seenBy: ctx.userId })
        .where(
          and(
            eq(interests.orgId, ctx.tenantId),
            eq(interests.id, id),
            isNull(interests.seenAt),
          ),
        );
      return requireInterest(tx, ctx.tenantId, id);
    }),
  );
}
