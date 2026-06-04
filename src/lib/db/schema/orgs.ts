import { pgTable, text, timestamp, uniqueIndex, pgPolicy } from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import { authenticatedRole } from "drizzle-orm/supabase";

export const orgs = pgTable(
  "orgs",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    slug: text("slug"),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("orgs_slug_unique").on(table.slug),
    pgPolicy("orgs_select_active_org", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.id} = (auth.jwt() ->> 'org_id')`,
    }),
  ],
).enableRLS();

export type Org = InferSelectModel<typeof orgs>;
export type NewOrg = InferInsertModel<typeof orgs>;
