import {
  pgTable,
  text,
  uuid,
  timestamp,
  primaryKey,
  index,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import { authenticatedRole } from "drizzle-orm/supabase";

import { orgs } from "./orgs";
import { users } from "./users";
import { companies } from "./companies";
import { appRuntimeRole, identityVerifierRole } from "../roles";

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
    scopedCompanyId: uuid("scoped_company_id").references(() => companies.id, {
      onDelete: "cascade",
    }),
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
    // NOB-158: o operador confere que não é membro do escritório que verifica.
    pgPolicy("org_memberships_identity_verifier_read", {
      for: "select",
      to: identityVerifierRole,
      using: sql`true`,
    }),
    pgPolicy("org_memberships_risk_actor_read", {
      for: "select",
      to: appRuntimeRole,
      using: sql`${table.orgId} = current_setting('app.current_org', true) and nullif(current_setting('app.current_actor', true), '') is not null`,
    }),
  ],
).enableRLS();

export type OrgMembership = InferSelectModel<typeof orgMemberships>;
export type NewOrgMembership = InferInsertModel<typeof orgMemberships>;
