import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  index,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import { authenticatedRole } from "drizzle-orm/supabase";

import { orgs } from "./orgs";
import { users } from "./users";

export const orgMemberships = pgTable(
  "org_memberships",
  {
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.orgId, table.userId] }),
    index("org_memberships_user_idx").on(table.userId),
    pgPolicy("org_memberships_select_active_org", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.orgId} = (auth.jwt() ->> 'org_id')`,
    }),
  ],
).enableRLS();

export type OrgMembership = InferSelectModel<typeof orgMemberships>;
export type NewOrgMembership = InferInsertModel<typeof orgMemberships>;
