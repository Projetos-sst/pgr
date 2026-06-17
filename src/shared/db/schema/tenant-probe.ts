import { pgTable, text, uuid, timestamp, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";

const tenantScope = sql`organization_id = current_setting('app.current_org', true)`;

export const tenantProbe = pgTable(
  "tenant_probe",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tenant_probe_organization_id").on(table.organizationId),
    pgPolicy("tenant_probe_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type TenantProbe = InferSelectModel<typeof tenantProbe>;
export type NewTenantProbe = InferInsertModel<typeof tenantProbe>;
