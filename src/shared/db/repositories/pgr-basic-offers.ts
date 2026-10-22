import "server-only";
import { and, eq, desc, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import {
  basicOfferMissingFields,
  basicOfferPublicationSchema,
  type BasicOfferInput,
} from "@/shared/domains/pgr/basic-offer";
import type { z } from "zod";
import { resolvePageParams, type PageParams } from "@/shared/pagination";
import { withOrg, type TenantTransaction } from "../with-org";
import {
  pgrBasicOfferVersions as versions,
  pgrBasicOfferPublication as publication,
  pgrBasicOfferEvents as events,
} from "../schema/pgr-basic-offers";
import { auditedTenantWrite } from "./audited-write";
function owner(ctx: TenantContext) {
  if (ctx.role !== "owner")
    throw new ForbiddenError("Somente o owner pode administrar a oferta de PGR básico.");
}
async function lock(tx: TenantTransaction, ctx: TenantContext) {
  await tx.execute(sql`select set_config('app.current_actor',${ctx.userId},true)`);
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${ctx.tenantId},106))`,
  );
}
export async function listBasicOffers(ctx: TenantContext, page: PageParams = {}) {
  owner(ctx);
  return withOrg(ctx.tenantId, async (tx) => {
    const { limit, offset } = resolvePageParams(page);
    const rows = await tx
      .select()
      .from(versions)
      .where(eq(versions.orgId, ctx.tenantId))
      .orderBy(desc(versions.version))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(versions)
      .where(eq(versions.orgId, ctx.tenantId));
    const [current] = await tx
      .select()
      .from(publication)
      .where(eq(publication.orgId, ctx.tenantId))
      .limit(1);
    const history = await tx
      .select()
      .from(events)
      .where(eq(events.orgId, ctx.tenantId))
      .orderBy(desc(events.createdAt), desc(events.id))
      .limit(limit)
      .offset(offset);
    const [{ eventTotal }] = await tx
      .select({ eventTotal: sql<number>`count(*)::int` })
      .from(events)
      .where(eq(events.orgId, ctx.tenantId));
    return {
      rows,
      total,
      activeVersionId: current?.activeVersionId ?? null,
      history: { rows: history, total: eventTotal },
    };
  });
}
export async function getBasicOffer(ctx: TenantContext, id: string) {
  owner(ctx);
  return withOrg(ctx.tenantId, async (tx) => {
    const [row] = await tx
      .select()
      .from(versions)
      .where(and(eq(versions.orgId, ctx.tenantId), eq(versions.id, id)))
      .limit(1);
    if (!row) throw new NotFoundError();
    return row;
  });
}
export async function createBasicOffer(ctx: TenantContext, data: BasicOfferInput) {
  owner(ctx);
  return auditedTenantWrite(ctx.tenantId, "pgr.basic_offer.create", () =>
    withOrg(ctx.tenantId, async (tx) => {
      await lock(tx, ctx);
      const [{ latest }] = await tx
        .select({ latest: sql<number>`coalesce(max(version),0)::int` })
        .from(versions)
        .where(eq(versions.orgId, ctx.tenantId));
      const [row] = await tx
        .insert(versions)
        .values({ orgId: ctx.tenantId, version: latest + 1, data, createdBy: ctx.userId })
        .returning();
      await tx.insert(events).values({
        orgId: ctx.tenantId,
        versionId: row.id,
        event: "created",
        actor: ctx.userId,
        details: { reason: data.reason },
      });
      return row;
    }),
  );
}
export async function publishBasicOffer(
  ctx: TenantContext,
  id: string,
  input: z.infer<typeof basicOfferPublicationSchema>,
) {
  owner(ctx);
  return auditedTenantWrite(ctx.tenantId, "pgr.basic_offer.publication", () =>
    withOrg(ctx.tenantId, async (tx) => {
      await lock(tx, ctx);
      const [row] = await tx
        .select()
        .from(versions)
        .where(and(eq(versions.orgId, ctx.tenantId), eq(versions.id, id)))
        .limit(1);
      if (!row) throw new NotFoundError();
      const [current] = await tx
        .select()
        .from(publication)
        .where(eq(publication.orgId, ctx.tenantId))
        .limit(1);
      const previous = current?.activeVersionId ?? null;
      if (input.expectedActiveVersionId !== previous)
        throw new ValidationError(
          "A publicação mudou. Atualize a página antes de continuar.",
        );
      if (input.active && basicOfferMissingFields(row.data).length)
        throw new ValidationError(
          "Complete público, escopo, serviços, limites, preço e periodicidade antes de publicar.",
        );
      if (!input.active && previous !== id)
        throw new ValidationError("Esta versão não está publicada.");
      const activeVersionId = input.active ? id : null;
      await tx
        .insert(publication)
        .values({ orgId: ctx.tenantId, activeVersionId, changedBy: ctx.userId })
        .onConflictDoUpdate({
          target: publication.orgId,
          set: { activeVersionId, changedBy: ctx.userId, changedAt: new Date() },
        });
      await tx.insert(events).values({
        orgId: ctx.tenantId,
        versionId: id,
        event: input.active ? "published" : "withdrawn",
        actor: ctx.userId,
        details: { ...input, previousActiveVersionId: previous },
      });
      return { activeVersionId };
    }),
  );
}
