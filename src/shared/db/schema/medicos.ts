import {
  pgTable,
  pgEnum,
  text,
  uuid,
  timestamp,
  index,
  uniqueIndex,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";

export const medicoStatus = pgEnum("medico_status", ["active", "inactive"]);

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

/**
 * Cadastro de médicos do trabalho (responsáveis por exames/ASO). Catálogo do
 * escritório, isolado por tenant. `clinic` é a clínica/empregador do médico
 * (texto livre — não é a empresa-cliente do tenant). CRM único por org.
 */
export const medicos = pgTable(
  "medicos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    crm: text("crm").notNull(),
    specialty: text("specialty"),
    clinic: text("clinic"),
    phone: text("phone"),
    status: medicoStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_medicos_org_id").on(table.orgId),
    uniqueIndex("uq_medicos_org_crm").on(table.orgId, table.crm),
    pgPolicy("medicos_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type Medico = InferSelectModel<typeof medicos>;
export type NewMedico = InferInsertModel<typeof medicos>;
