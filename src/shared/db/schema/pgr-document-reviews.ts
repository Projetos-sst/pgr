import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
  pgPolicy,
  check,
  unique,
  foreignKey,
} from "drizzle-orm/pg-core";
import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { pgr } from "./pgr";
import { documents } from "./documents";
import type { PgrReviewDecisionInput } from "@/shared/domains/pgr/document-review";
const tenant = sql`org_id=current_setting('app.current_org',true)`;
const owner = sql`exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))`;
export const pgrReviewSamples = pgTable(
  "pgr_review_samples",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    pgrId: uuid("pgr_id")
      .notNull()
      .references(() => pgr.id, { onDelete: "restrict" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "restrict" }),
    supersedesSampleId: uuid("supersedes_sample_id"),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    snapshotSha256: text("snapshot_sha256").notNull(),
    templateSha256: text("template_sha256").notNull(),
    fileSha256: text("file_sha256").notNull(),
    createdBy: text("created_by").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_pgr_review_samples").on(t.orgId, t.pgrId, t.createdAt),
    unique("uq_pgr_review_sample_context").on(t.id, t.orgId, t.pgrId),
    foreignKey({
      columns: [t.supersedesSampleId, t.orgId, t.pgrId],
      foreignColumns: [t.id, t.orgId, t.pgrId],
    }).onDelete("restrict"),
    pgPolicy("pgr_review_samples_tenant", {
      for: "all",
      to: appRuntimeRole,
      using: tenant,
      withCheck: tenant,
    }),
    pgPolicy("pgr_review_samples_actor", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.createdBy}=current_setting('app.current_actor',true)`,
    }),
    pgPolicy("pgr_review_samples_context", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: sql`exists(select 1 from public.pgr p where p.id=${t.pgrId} and p.org_id=${t.orgId})`,
      withCheck: sql`exists(select 1 from public.pgr p where p.id=${t.pgrId} and p.org_id=${t.orgId}) and exists(select 1 from public.documents d where d.id=${t.documentId} and d.org_id=${t.orgId} and d.related_entity_type='pgr' and d.related_entity_id=${t.pgrId})`,
    }),
  ],
).enableRLS();
export const pgrReviewDecisions = pgTable(
  "pgr_review_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    sampleId: uuid("sample_id")
      .notNull()
      .references(() => pgrReviewSamples.id, { onDelete: "restrict" }),
    status: text("status").notNull(),
    data: jsonb("data").$type<PgrReviewDecisionInput>().notNull(),
    recordedBy: text("recorded_by").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_pgr_review_decisions").on(t.orgId, t.sampleId, t.recordedAt),
    check(
      "pgr_review_decisions_status",
      sql`${t.status} in ('accepted','changes_requested')`,
    ),
    pgPolicy("pgr_review_decisions_tenant", {
      for: "all",
      to: appRuntimeRole,
      using: tenant,
      withCheck: tenant,
    }),
    pgPolicy("pgr_review_decisions_context", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: sql`exists(select 1 from public.pgr_review_samples s where s.id=${t.sampleId} and s.org_id=${t.orgId})`,
      withCheck: sql`exists(select 1 from public.pgr_review_samples s where s.id=${t.sampleId} and s.org_id=${t.orgId})`,
    }),
    pgPolicy("pgr_review_decisions_owner", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${owner} and ${t.recordedBy}=current_setting('app.current_actor',true)`,
    }),
  ],
).enableRLS();
