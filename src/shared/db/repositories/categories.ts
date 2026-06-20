import "server-only";

import { eq } from "drizzle-orm";

import { categoryTypeSchema } from "@/shared/domains/pgr/validation";

import { withOrg } from "../with-org";
import { categories, type Category } from "../schema/categories";
import { auditedTenantWrite } from "./audited-write";

export type NewCategoryInput = {
  type: string;
  name: string;
  note?: string | null;
};

export async function listCategories(orgId: string): Promise<Category[]> {
  return withOrg(orgId, (tx) =>
    tx.select().from(categories).where(eq(categories.orgId, orgId)),
  );
}

export async function createCategory(
  orgId: string,
  input: NewCategoryInput,
): Promise<Category> {
  const type = categoryTypeSchema.parse(input.type);
  return auditedTenantWrite(orgId, "pgr.categories.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .insert(categories)
        .values({ orgId, type, name: input.name, note: input.note ?? null })
        .returning();
      return row;
    }),
  );
}
