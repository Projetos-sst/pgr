import {
  pgTable,
  pgEnum,
  text,
  uuid,
  timestamp,
  index,
  uniqueIndex,
  unique,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";

export const categoryType = pgEnum("category_type", ["epi", "machine"]);

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    type: categoryType("type").notNull(),
    name: text("name").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_categories_org_id").on(table.orgId),
    uniqueIndex("uq_categories_org_type_name").on(table.orgId, table.type, table.name),
    // UNIQUE constraint (não índice) sobre (id, type) — é o alvo da FK composta de
    // `epi_catalog (category_id, type)`, que garante item.type == categoria.type (008/FR-002a).
    // Postgres exige uma unique/primary key constraint como alvo de FK; um unique index não basta.
    unique("uq_categories_id_type").on(table.id, table.type),
    pgPolicy("categories_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;
