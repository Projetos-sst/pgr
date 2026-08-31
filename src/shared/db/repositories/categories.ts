import "server-only";

import { and, asc, eq, ilike, sql, type SQL } from "drizzle-orm";

import type {
  CategoryType,
  CategoryValues,
  CategoryListItem,
} from "@/shared/domains/pgr/categories";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg } from "../with-org";
import { categories, type Category } from "../schema/categories";
import { auditedTenantWrite } from "./audited-write";

export type ListCategoriesParams = PageParams & {
  search?: string;
  type?: CategoryType;
  isActive?: boolean;
};

export async function listCategories(
  orgId: string,
  params: ListCategoriesParams = {},
): Promise<Paginated<CategoryListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const search = params.search?.trim();
  const filters: SQL[] = [eq(categories.orgId, orgId)];
  if (search) filters.push(ilike(categories.name, `%${search}%`));
  if (params.type) filters.push(eq(categories.type, params.type));
  if (params.isActive !== undefined) {
    filters.push(eq(categories.isActive, params.isActive));
  }
  const where = and(...filters);

  // Itens vinculados (#192) — COUNT correlacionado QUALIFICADO (ver lição do #188)
  // de epi_catalog por categoria, escopado ao tenant. Derivado, sem coluna.
  const itemCount = sql<number>`(
    select count(*)::int from "epi_catalog"
    where "epi_catalog"."category_id" = "categories"."id"
      and "epi_catalog"."org_id" = ${orgId}
  )`;

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: categories.id,
        orgId: categories.orgId,
        type: categories.type,
        name: categories.name,
        note: categories.note,
        isActive: categories.isActive,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
        itemCount,
      })
      .from(categories)
      .where(where)
      .orderBy(asc(categories.name))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(categories)
      .where(where);
    return { rows, total };
  });
}

export async function getCategoryById(
  orgId: string,
  id: string,
): Promise<Category | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(categories)
      .where(and(eq(categories.orgId, orgId), eq(categories.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function createCategory(
  orgId: string,
  input: CategoryValues,
): Promise<Category> {
  return auditedTenantWrite(orgId, "pgr.categories.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .insert(categories)
        .values({
          orgId,
          type: input.type,
          name: input.name,
          note: input.note ?? null,
          isActive: input.isActive,
        })
        .returning();
      return row;
    }),
  );
}

export async function updateCategory(
  orgId: string,
  id: string,
  input: CategoryValues,
): Promise<Category | null> {
  return auditedTenantWrite(orgId, "pgr.categories.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .update(categories)
        .set({
          type: input.type,
          name: input.name,
          note: input.note ?? null,
          isActive: input.isActive,
          updatedAt: new Date(),
        })
        .where(and(eq(categories.orgId, orgId), eq(categories.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteCategory(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "pgr.categories.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(categories)
        .where(and(eq(categories.orgId, orgId), eq(categories.id, id)))
        .returning({ id: categories.id });
      return rows.length > 0;
    }),
  );
}
