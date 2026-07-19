import {
  pgTable,
  pgEnum,
  text,
  uuid,
  integer,
  bigint,
  date,
  timestamp,
  index,
  unique,
  check,
  pgPolicy,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

export const documentStatus = pgEnum("document_status", ["generating", "ready"]);

export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => folders.id, {
      onDelete: "restrict",
    }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_folders_org_id").on(table.orgId),
    index("idx_folders_parent_id").on(table.parentId),
    unique("uq_folders_org_parent_name")
      .on(table.orgId, table.parentId, table.name)
      .nullsNotDistinct(),
    pgPolicy("folders_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => folders.id, { onDelete: "restrict" }),
    documentGroupId: uuid("document_group_id").notNull(),
    name: text("name").notNull(),
    docType: text("doc_type").notNull(),
    version: integer("version").notNull().default(1),
    status: documentStatus("status").notNull().default("ready"),
    storagePath: text("storage_path").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    validUntil: date("valid_until"),
    relatedEntityType: text("related_entity_type"),
    relatedEntityId: uuid("related_entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_documents_org_id").on(table.orgId),
    index("idx_documents_folder_id").on(table.folderId),
    index("idx_documents_org_group").on(table.orgId, table.documentGroupId),
    index("idx_documents_related_entity")
      .on(table.orgId, table.relatedEntityType, table.relatedEntityId)
      .where(sql`related_entity_type is not null`),
    unique("uq_documents_org_group_version").on(
      table.orgId,
      table.documentGroupId,
      table.version,
    ),
    check("documents_version_check", sql`version >= 1`),
    check("documents_size_bytes_check", sql`size_bytes >= 0`),
    check(
      "documents_related_entity_check",
      sql`(related_entity_type is null) = (related_entity_id is null)`,
    ),
    pgPolicy("documents_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type Folder = InferSelectModel<typeof folders>;
export type NewFolder = InferInsertModel<typeof folders>;
export type Document = InferSelectModel<typeof documents>;
export type NewDocument = InferInsertModel<typeof documents>;
