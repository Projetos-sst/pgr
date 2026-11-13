import { and, eq, inArray, isNotNull, isNull, max, sql, type SQL } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { todayInSaoPaulo } from "@/shared/dates";
import {
  CommercialCatalogError,
  catalogOperatorSchema,
  deactivationReasonSchema,
  type CatalogCommand,
  type CatalogErrorReason,
} from "@/shared/domains/commercial/catalog-admin";
import { FICTITIOUS_CATALOG } from "@/shared/domains/commercial/fictitious-catalog";
import {
  isFictitiousCatalogAllowedFor,
  offerState,
  offerVersionInputSchema,
  type CommercialEnvironment,
  type OfferVersionInput,
} from "@/shared/domains/commercial/offer";

import { commercialOfferItems, commercialOfferVersions } from "../schema/commercial";

const items = commercialOfferItems;
const versions = commercialOfferVersions;

export type CatalogDb = PostgresJsDatabase<Record<string, unknown>>;
export type CatalogReader = Pick<CatalogDb, "select">;

export const ON_SALE_CANDIDATES = and(
  isNotNull(versions.publishedAt),
  isNull(versions.deactivatedAt),
);

export async function loadOfferVersions(reader: CatalogReader, where?: SQL) {
  const rows = await reader.select().from(versions).where(where);
  if (rows.length === 0) return [];
  const itemRows = await reader
    .select({
      offerVersionId: items.offerVersionId,
      position: items.position,
      service: items.service,
      label: items.label,
      unit: items.unit,
      unitAmountCents: items.unitAmountCents,
    })
    .from(items)
    .where(
      inArray(
        items.offerVersionId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(items.offerVersionId, items.position);
  return rows.map((row) => ({
    ...row,
    items: itemRows
      .filter((item) => item.offerVersionId === row.id)
      .map(({ service, label, unit, unitAmountCents }) => ({
        service,
        label,
        unit,
        unitAmountCents,
      })),
  }));
}
export type StoredOfferVersion = Awaited<ReturnType<typeof loadOfferVersions>>[number];

export async function createOfferVersion(
  db: CatalogDb,
  input: OfferVersionInput,
  operator: string,
) {
  const { items: offerItems, ...header } = offerVersionInputSchema.parse(input);
  const createdBy = catalogOperatorSchema.parse(operator);
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`commercial_offer:${header.code}`}, 0))`,
    );
    const [{ last }] = await tx
      .select({ last: max(versions.version) })
      .from(versions)
      .where(eq(versions.code, header.code));
    const [created] = await tx
      .insert(versions)
      .values({ ...header, version: (last ?? 0) + 1, createdBy })
      .returning({ id: versions.id, code: versions.code, version: versions.version });
    await tx.insert(items).values(
      offerItems.map((item, index) => ({
        ...item,
        offerVersionId: created.id,
        position: index + 1,
      })),
    );
    return created;
  });
}

export async function publishOfferVersion(
  db: CatalogDb,
  id: string,
  operator: string,
): Promise<void> {
  const published = await db
    .update(versions)
    .set({ publishedAt: sql`now()`, publishedBy: catalogOperatorSchema.parse(operator) })
    .where(and(eq(versions.id, id), isNull(versions.publishedAt)))
    .returning({ id: versions.id });
  if (published.length > 0) return;
  const [existing] = await db
    .select({ id: versions.id })
    .from(versions)
    .where(eq(versions.id, id));
  throw new CommercialCatalogError(existing ? "already_published" : "not_found");
}

function deactivationProblem(
  existing: { publishedAt: Date | null } | undefined,
): CatalogErrorReason {
  if (!existing) return "not_found";
  return existing.publishedAt ? "already_deactivated" : "not_published";
}

export async function deactivateOfferVersion(
  db: CatalogDb,
  id: string,
  operator: string,
  reason: string,
): Promise<void> {
  const deactivated = await db
    .update(versions)
    .set({
      deactivatedAt: sql`now()`,
      deactivatedBy: catalogOperatorSchema.parse(operator),
      deactivationReason: deactivationReasonSchema.parse(reason),
    })
    .where(
      and(
        eq(versions.id, id),
        isNotNull(versions.publishedAt),
        isNull(versions.deactivatedAt),
      ),
    )
    .returning({ id: versions.id });
  if (deactivated.length > 0) return;
  const [existing] = await db
    .select({ publishedAt: versions.publishedAt })
    .from(versions)
    .where(eq(versions.id, id));
  throw new CommercialCatalogError(deactivationProblem(existing));
}

export async function listOfferVersions(db: CatalogDb, today = todayInSaoPaulo()) {
  const stored = await loadOfferVersions(db);
  return stored
    .map((version) => ({ ...version, state: offerState(version, today) }))
    .sort((a, b) =>
      a.code === b.code ? a.version - b.version : a.code < b.code ? -1 : 1,
    );
}

export async function seedFictitiousCatalog(
  db: CatalogDb,
  env: CommercialEnvironment,
  operator: string,
) {
  if (!isFictitiousCatalogAllowedFor(env))
    throw new CommercialCatalogError("fictitious_not_allowed");
  const existing = new Set(
    (await db.selectDistinct({ code: versions.code }).from(versions)).map(
      (row) => row.code,
    ),
  );
  const created: string[] = [];
  for (const offer of FICTITIOUS_CATALOG.filter((o) => !existing.has(o.code))) {
    const version = await createOfferVersion(db, offer, operator);
    await publishOfferVersion(db, version.id, operator);
    created.push(offer.code);
  }
  const skipped = FICTITIOUS_CATALOG.map((offer) => offer.code).filter((code) =>
    existing.has(code),
  );
  return { created, skipped };
}

export type CatalogCommandContext = {
  env: CommercialEnvironment;
  operator: string;
  readJsonFile: (path: string) => Promise<unknown>;
};

export async function runCatalogCommand(
  db: CatalogDb,
  command: CatalogCommand,
  context: CatalogCommandContext,
): Promise<unknown> {
  switch (command.kind) {
    case "seed-fictitious":
      return seedFictitiousCatalog(db, context.env, context.operator);
    case "list":
      return (await listOfferVersions(db)).map(
        ({ id, code, version, state, fictitious }) => ({
          id,
          code,
          version,
          state,
          fictitious,
        }),
      );
    case "create":
      return createOfferVersion(
        db,
        offerVersionInputSchema.parse(await context.readJsonFile(command.file)),
        context.operator,
      );
    case "publish":
      await publishOfferVersion(db, command.id, context.operator);
      return { published: command.id };
    case "deactivate":
      await deactivateOfferVersion(db, command.id, context.operator, command.reason);
      return { deactivated: command.id };
  }
}
