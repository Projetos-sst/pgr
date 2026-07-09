import { pgTable, text, uuid, timestamp, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

/**
 * Trilha append-only de uso de recursos de IA por organização. Serve **apenas** ao
 * rate limiting por tenant (contagem no mês corrente), espelhando como a assinatura
 * conta `signature_requests` — cota derivada da leitura, sem contador materializado
 * nem cron. `kind` discrimina o recurso (ex.: `risk_suggestion`) para futuras
 * features de IA reusarem a mesma tabela. Sem `updated_at` (linha imutável).
 */
export const aiUsageEvents = pgTable(
  "ai_usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_ai_usage_events_org_id").on(table.orgId),
    index("idx_ai_usage_events_org_kind_created").on(
      table.orgId,
      table.kind,
      table.createdAt,
    ),
    pgPolicy("ai_usage_events_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type AiUsageEvent = InferSelectModel<typeof aiUsageEvents>;
export type NewAiUsageEvent = InferInsertModel<typeof aiUsageEvents>;
