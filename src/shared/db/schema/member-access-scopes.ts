import { sql, type InferSelectModel } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  unique,
  check,
  pgPolicy,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";

import type { AccessArea } from "@/shared/domains/platform/access-scopes";

import { appRuntimeRole } from "../roles";
import { companies } from "./companies";
import { orgMemberships } from "./org-memberships";
import { workUnits } from "./work-units";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;
const actor = sql`current_setting('app.current_actor', true)`;
const officeOwner = sql`exists (select 1 from public.org_memberships om where om.org_id = current_setting('app.current_org', true) and om.user_id = ${actor} and om.role in ('owner','org:admin'))`;

export const memberAccessScopes = pgTable(
  "member_access_scopes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
    companyId: uuid("company_id").notNull(),
    workUnitId: uuid("work_unit_id"),
    area: text("area").$type<AccessArea>().notNull(),
    grantedBy: text("granted_by").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_member_access_scopes")
      .on(table.orgId, table.userId, table.companyId, table.workUnitId, table.area)
      .nullsNotDistinct(),
    index("idx_member_access_scopes_company").on(table.orgId, table.companyId),
    check("member_access_scopes_area_check", sql`${table.area} in ('safety', 'health')`),
    foreignKey({
      name: "member_access_scopes_member_fk",
      columns: [table.orgId, table.userId],
      foreignColumns: [orgMemberships.orgId, orgMemberships.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "member_access_scopes_company_fk",
      columns: [table.companyId, table.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      name: "member_access_scopes_work_unit_fk",
      columns: [table.workUnitId, table.companyId],
      foreignColumns: [workUnits.id, workUnits.companyId],
    }).onDelete("cascade"),
    pgPolicy("member_access_scopes_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("member_access_scopes_own_or_owner_read", {
      as: "restrictive",
      for: "select",
      to: appRuntimeRole,
      using: sql`${table.userId} = ${actor} or ${officeOwner}`,
    }),
    pgPolicy("member_access_scopes_owner_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${table.grantedBy} = ${actor} and ${officeOwner}`,
    }),
    pgPolicy("member_access_scopes_owner_delete", {
      as: "restrictive",
      for: "delete",
      to: appRuntimeRole,
      using: officeOwner,
    }),
  ],
).enableRLS();

export type MemberAccessScope = InferSelectModel<typeof memberAccessScopes>;
