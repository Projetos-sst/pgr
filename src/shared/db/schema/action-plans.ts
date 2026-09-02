import {
  pgTable,
  text,
  uuid,
  numeric,
  smallint,
  date,
  timestamp,
  index,
  check,
  pgPolicy,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

export const actionPlanStatus = pgEnum("action_plan_status", [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);

// Plano de Ação 5W2H multiorigem. `origin_type` é TEXT validado na aplicação
// (V1 = risk|incident; inspection/non_conformity plugam depois sem migration).
// `origin_id` NÃO tem FK física (polimórfico) — validação de existência/tenant na app.
// Acoplamento UNIDIRECIONAL: action_plans pode avançar o ciclo do incidente; o inverso não.
export const actionPlans = pgTable(
  "action_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    originType: text("origin_type").notNull(),
    originId: uuid("origin_id").notNull(),
    what: text("what").notNull(),
    why: text("why").notNull(),
    who: text("who").notNull(),
    where: text("where").notNull(),
    when: date("when"),
    how: text("how").notNull(),
    howMuch: numeric("how_much"),
    priority: smallint("priority"),
    status: actionPlanStatus("status").notNull().default("planned"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_action_plans_org_id").on(table.orgId),
    index("idx_action_plans_origin").on(table.orgId, table.originType, table.originId),
    index("idx_action_plans_org_status").on(table.orgId, table.status),
    check("action_plans_priority_check", sql`priority between 1 and 3`),
    pgPolicy("action_plans_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type ActionPlan = InferSelectModel<typeof actionPlans>;
export type NewActionPlan = InferInsertModel<typeof actionPlans>;
