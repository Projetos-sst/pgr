import {
  pgTable,
  text,
  uuid,
  timestamp,
  index,
  uniqueIndex,
  pgPolicy,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

export const riskAuditStatus = pgEnum("risk_audit_status", [
  "awaiting_analysis",
  "planning_actions",
  "completed",
]);

// Auditoria/Análise em kanban por origem (risk|incident, TEXT validado na app).
// Somente UMA auditoria ativa por origem: UNIQUE parcial WHERE status <> 'completed'.
// Não substitui o ciclo de vida do incidente; planos vinculam-se à origem, não à auditoria.
export const riskAudits = pgTable(
  "risk_audits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    originType: text("origin_type").notNull(),
    originId: uuid("origin_id").notNull(),
    status: riskAuditStatus("status").notNull().default("awaiting_analysis"),
    justification: text("justification"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_risk_audits_org_id").on(table.orgId),
    index("idx_risk_audits_origin").on(table.orgId, table.originType, table.originId),
    index("idx_risk_audits_org_status").on(table.orgId, table.status),
    uniqueIndex("uq_risk_audits_active_origin")
      .on(table.orgId, table.originType, table.originId)
      .where(sql`status <> 'completed'`),
    pgPolicy("risk_audits_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type RiskAudit = InferSelectModel<typeof riskAudits>;
export type NewRiskAudit = InferInsertModel<typeof riskAudits>;
