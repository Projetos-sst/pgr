"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  categoryInputSchema,
  type CategoryInput,
  type CategoryListItem,
} from "@/shared/domains/pgr/categories";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/categories";
import type { Category } from "@/shared/db/schema";

const BASE_PATH = "/categories";

export async function listCategoriesAction(
  params: repo.ListCategoriesParams = {},
): Promise<ActionResult<Paginated<CategoryListItem>>> {
  return officeAction("pgr.categories.list", ({ tenantId }) =>
    repo.listCategories(tenantId, params),
  );
}

export async function getCategoryAction(id: string): Promise<ActionResult<Category>> {
  return officeAction("pgr.categories.get", async ({ tenantId }) => {
    const category = await repo.getCategoryById(tenantId, id);
    if (!category) throw new NotFoundError();
    return category;
  });
}

export async function createCategoryAction(
  input: CategoryInput,
): Promise<ActionResult<Category>> {
  return officeAction(
    "pgr.categories.create",
    async ({ tenantId }) => {
      const data = categoryInputSchema.parse(input);
      const category = await repo.createCategory(tenantId, data);
      revalidatePath(BASE_PATH);
      return category;
    },
    { audit: true },
  );
}

export async function updateCategoryAction(
  id: string,
  input: CategoryInput,
): Promise<ActionResult<Category>> {
  return officeAction(
    "pgr.categories.update",
    async ({ tenantId }) => {
      const data = categoryInputSchema.parse(input);
      const category = await repo.updateCategory(tenantId, id, data);
      if (!category) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      revalidatePath(`${BASE_PATH}/${id}/edit`);
      return category;
    },
    { audit: true },
  );
}

export async function deleteCategoryAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.categories.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteCategory(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return { id };
    },
    { audit: true },
  );
}
