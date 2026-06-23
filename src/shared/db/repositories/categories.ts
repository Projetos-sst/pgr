import "server-only";

import { and, asc, eq, ilike, sql, type SQL } from "drizzle-orm";

import type { CategoryType, CategoryValues } from "@/shared/domains/pgr/categories";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg } from "../with-org";
import { categories, type Category } from "../schema/categories";
import { auditedTenantWrite } from "./audited-write";

export type ListCategoriesParams = PageParams & {
  search?: string;
  type?: CategoryType;
};

export async function listCategories(
  orgId: string,
  params: ListCategoriesParams = {},
): Promise<Paginated<Category>> {
  const { limit, offset } = resolvePageParams(params);
  const search = params.search?.trim();
  const filters: SQL[] = [eq(categories.orgId, orgId)];
  if (search) filters.push(ilike(categories.name, `%${search}%`));
  if (params.type) filters.push(eq(categories.type, params.type));
  const where = and(...filters);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select()
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
        .values({ orgId, type: input.type, name: input.name, note: input.note ?? null })
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
