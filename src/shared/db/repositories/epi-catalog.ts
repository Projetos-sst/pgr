import "server-only";

import { and, asc, eq, getTableColumns, ilike, or, sql, type SQL } from "drizzle-orm";

import type { CategoryType, EpiCatalogValues } from "@/shared/domains/pgr/epi-catalog";
import { EntityInUseError } from "@/shared/errors/entity-in-use-error";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg, type TenantTransaction } from "../with-org";
import { categories } from "../schema/categories";
import {
  epiCatalog,
  epiDeliveryItems,
  epiRisk,
  epiStock,
  type EpiCatalog,
} from "../schema/epis";
import { auditedTenantWrite } from "./audited-write";

export type ListEpiCatalogParams = PageParams & {
  search?: string;
  type?: CategoryType;
};

export type EpiCatalogListItem = EpiCatalog & { categoryName: string };

export type EpiCatalogDependents = {
  stock: number;
  risk: number;
  deliveryItems: number;
};

const AUDIT_OP = "pgr.epi_catalog.write_rejected";

function toEpiCatalogColumns(input: EpiCatalogValues) {
  return {
    type: input.type,
    categoryId: input.categoryId,
    name: input.name,
    ca: input.ca ?? null,
    caValidUntil: input.caValidUntil ?? null,
    manufacturer: input.manufacturer ?? null,
    norm: input.norm ?? null,
    size: input.size ?? null,
    unitOfMeasure: input.unitOfMeasure ?? null,
    description: input.description ?? null,
    photoPath: input.photoPath ?? null,
  };
}

/**
 * Walks the `cause` chain (postgres-js errors surfaced via Drizzle wrap the real
 * SQLSTATE on `error.cause.code`) looking for a foreign-key violation (23503).
 */
function isForeignKeyViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth <= 5 && current; depth += 1) {
    if (typeof current === "object" && current !== null && "code" in current) {
      if ((current as { code: unknown }).code === "23503") return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Categoria deve existir no tenant ativo E ter o mesmo `type` do item. A FK
 * composta `(category_id, type) → categories(id, type)` é checada pelo Postgres
 * ignorando RLS, então este assert sob `withOrg` é a barreira real de isolamento
 * (categoria de outro tenant / tipo divergente / inexistente → FK_NOT_FOUND).
 */
async function assertCategoryInTenant(
  tx: TenantTransaction,
  orgId: string,
  categoryId: string,
  type: CategoryType,
): Promise<void> {
  const [row] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.orgId, orgId),
        eq(categories.id, categoryId),
        eq(categories.type, type),
      ),
    )
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("category");
}

async function countDependentsTx(
  tx: TenantTransaction,
  orgId: string,
  id: string,
): Promise<EpiCatalogDependents> {
  const countWhere = (
    table: typeof epiStock | typeof epiRisk | typeof epiDeliveryItems,
  ) =>
    tx
      .select({ total: sql<number>`count(*)::int` })
      .from(table)
      .where(and(eq(table.orgId, orgId), eq(table.catalogId, id)));

  const [[stock], [risk], [deliveryItems]] = await Promise.all([
    countWhere(epiStock),
    countWhere(epiRisk),
    countWhere(epiDeliveryItems),
  ]);
  return { stock: stock.total, risk: risk.total, deliveryItems: deliveryItems.total };
}

export async function listEpiCatalog(
  orgId: string,
  params: ListEpiCatalogParams = {},
): Promise<Paginated<EpiCatalogListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const search = params.search?.trim();
  // Join escopado por tenant E por tipo (defesa em profundidade, além da RLS).
  const joinCondition = and(
    eq(epiCatalog.categoryId, categories.id),
    eq(categories.orgId, orgId),
    eq(categories.type, epiCatalog.type),
  );
  const filters: SQL[] = [eq(epiCatalog.orgId, orgId)];
  if (search) {
    const term = `%${search}%`;
    filters.push(
      or(
        ilike(epiCatalog.name, term),
        ilike(epiCatalog.ca, term),
        ilike(categories.name, term),
      )!,
    );
  }
  if (params.type) filters.push(eq(epiCatalog.type, params.type));
  const where = and(...filters);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({ ...getTableColumns(epiCatalog), categoryName: categories.name })
      .from(epiCatalog)
      .innerJoin(categories, joinCondition)
      .where(where)
      .orderBy(asc(epiCatalog.name))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(epiCatalog)
      .innerJoin(categories, joinCondition)
      .where(where);
    return { rows, total };
  });
}

export async function getEpiCatalogById(
  orgId: string,
  id: string,
): Promise<EpiCatalog | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(epiCatalog)
      .where(and(eq(epiCatalog.orgId, orgId), eq(epiCatalog.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function createEpiCatalog(
  orgId: string,
  input: EpiCatalogValues,
): Promise<EpiCatalog> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      await assertCategoryInTenant(tx, orgId, input.categoryId, input.type);
      const [row] = await tx
        .insert(epiCatalog)
        .values({ orgId, ...toEpiCatalogColumns(input) })
        .returning();
      return row;
    }),
  );
}

export async function updateEpiCatalog(
  orgId: string,
  id: string,
  input: EpiCatalogValues,
): Promise<EpiCatalog | null> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      await assertCategoryInTenant(tx, orgId, input.categoryId, input.type);
      const [row] = await tx
        .update(epiCatalog)
        .set({ ...toEpiCatalogColumns(input), updatedAt: new Date() })
        .where(and(eq(epiCatalog.orgId, orgId), eq(epiCatalog.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

/**
 * Exclusão atômica e defensiva (FR-015/016): numa única transação, trava a linha
 * do catálogo (`FOR UPDATE`), conta dependentes APÓS o lock e bloqueia com
 * `EntityInUseError` (IN_USE) se houver qualquer um — sem cascatear stock/risk.
 * O `RESTRICT` de `epi_delivery_items` é backstop: 23503 → IN_USE (local ao delete).
 */
export async function deleteEpiCatalog(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      const [locked] = await tx
        .select({ id: epiCatalog.id })
        .from(epiCatalog)
        .where(and(eq(epiCatalog.orgId, orgId), eq(epiCatalog.id, id)))
        .for("update")
        .limit(1);
      if (!locked) return false;

      const deps = await countDependentsTx(tx, orgId, id);
      if (deps.stock + deps.risk + deps.deliveryItems > 0) {
        throw new EntityInUseError();
      }

      try {
        const rows = await tx
          .delete(epiCatalog)
          .where(and(eq(epiCatalog.orgId, orgId), eq(epiCatalog.id, id)))
          .returning({ id: epiCatalog.id });
        return rows.length > 0;
      } catch (error) {
        if (isForeignKeyViolation(error)) throw new EntityInUseError();
        throw error;
      }
    }),
  );
}

/** Contagem informativa de dependentes para a UI (sem lock). */
export async function countEpiCatalogDependents(
  orgId: string,
  id: string,
): Promise<EpiCatalogDependents> {
  return withOrg(orgId, (tx) => countDependentsTx(tx, orgId, id));
}
