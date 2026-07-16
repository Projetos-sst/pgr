import {
  pgTable,
  pgEnum,
  text,
  uuid,
  date,
  timestamp,
  index,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

export const scheduleEventType = pgEnum("schedule_event_type", [
  "inspection",
  "training",
  "exam",
  "document_expiry",
  "other",
]);

export const scheduleEvents = pgTable(
  "schedule_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    eventType: scheduleEventType("event_type").notNull(),
    title: text("title").notNull(),
    eventDate: date("event_date").notNull(),
    description: text("description"),
    referenceUrl: text("reference_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_schedule_events_org_id").on(table.orgId),
    index("idx_schedule_events_org_date").on(table.orgId, table.eventDate),
    pgPolicy("schedule_events_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type ScheduleEvent = InferSelectModel<typeof scheduleEvents>;
export type NewScheduleEvent = InferInsertModel<typeof scheduleEvents>;
