import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  pgPolicy,
  check,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import { authenticatedRole } from "drizzle-orm/supabase";

export const orgs = pgTable(
  "orgs",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    slug: text("slug"),
    imageUrl: text("image_url"),
    plan: text("plan").notNull().default("free"),
    clerkOrgId: text("clerk_org_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("orgs_slug_unique").on(table.slug),
    uniqueIndex("orgs_clerk_org_id_unique").on(table.clerkOrgId),
    check("orgs_plan_check", sql`${table.plan} in ('free','pro')`),
    pgPolicy("orgs_select_active_org", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.id} = (auth.jwt() ->> 'org_id')`,
    }),
  ],
).enableRLS();

export type Org = InferSelectModel<typeof orgs>;
export type NewOrg = InferInsertModel<typeof orgs>;
