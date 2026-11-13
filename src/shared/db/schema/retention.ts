import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  bigint,
  integer,
  date,
  timestamp,
  index,
  pgPolicy,
  check,
} from "drizzle-orm/pg-core";

import type { RetentionExportStatus } from "@/shared/domains/retention/export-manifest";
import type {
  RetentionPolicyStatus,
  RetentionTerms,
} from "@/shared/domains/retention/policy";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { pgr } from "./pgr";

const tenant = sql`org_id=current_setting('app.current_org',true)`;
const actor = sql`current_setting('app.current_actor',true)`;
const administrator = sql`exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=${actor} and m.role in ('owner','org:admin'))`;

export const retentionPolicyVersions = pgTable(
  "retention_policy_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seq: bigint("seq", { mode: "number" }).notNull().generatedAlwaysAsIdentity(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    status: text("status").$type<RetentionPolicyStatus>().notNull(),
    terms: jsonb("terms").$type<RetentionTerms>().notNull(),
    termsSha256: text("terms_sha256").notNull(),
    approverName: text("approver_name"),
    approverRole: text("approver_role"),
    approvedOn: date("approved_on"),
    approvalReference: text("approval_reference"),
    recordedBy: text("recorded_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_retention_policy_versions").on(t.orgId, t.seq),
    check(
      "retention_policy_versions_status",
      sql`${t.status} in ('proposed','approved')`,
    ),
    check("retention_policy_versions_sha256", sql`${t.termsSha256} ~ '^[a-f0-9]{64}$'`),
    check(
      "retention_policy_versions_approval",
      sql`case ${t.status}
        when 'approved' then btrim(coalesce(${t.approverName},'')) <> '' and btrim(coalesce(${t.approverRole},'')) <> '' and ${t.approvedOn} is not null and btrim(coalesce(${t.approvalReference},'')) <> ''
        else ${t.approverName} is null and ${t.approverRole} is null and ${t.approvedOn} is null and ${t.approvalReference} is null
      end`,
    ),
    pgPolicy("retention_policy_versions_tenant", {
      for: "all",
      to: appRuntimeRole,
      using: tenant,
      withCheck: tenant,
    }),
    pgPolicy("retention_policy_versions_owner_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.recordedBy}=${actor} and ${administrator}`,
    }),
  ],
).enableRLS();

export const retentionExports = pgTable(
  "retention_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seq: bigint("seq", { mode: "number" }).notNull().generatedAlwaysAsIdentity(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    pgrId: uuid("pgr_id")
      .notNull()
      .references(() => pgr.id, { onDelete: "restrict" }),
    status: text("status").$type<RetentionExportStatus>().notNull(),
    contentSha256: text("content_sha256"),
    itemCount: integer("item_count").notNull(),
    missingCount: integer("missing_count").notNull(),
    hashMismatchCount: integer("hash_mismatch_count").notNull(),
    failureReason: text("failure_reason"),
    exportedBy: text("exported_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => {
    const visiblePgr = sql`exists(select 1 from public.pgr p where p.id=${t.pgrId} and p.org_id=${t.orgId})`;
    return [
      index("idx_retention_exports").on(t.orgId, t.pgrId, t.seq),
      check(
        "retention_exports_status",
        sql`${t.status} in ('complete','incomplete','failed')`,
      ),
      check(
        "retention_exports_counts",
        sql`${t.itemCount} >= 0 and ${t.missingCount} >= 0 and ${t.hashMismatchCount} >= 0`,
      ),
      check(
        "retention_exports_shape",
        sql`case ${t.status}
          when 'failed' then ${t.contentSha256} is null and ${t.failureReason} in ('storage_unavailable')
          when 'complete' then ${t.contentSha256} ~ '^[a-f0-9]{64}$' and ${t.failureReason} is null and ${t.missingCount} = 0 and ${t.hashMismatchCount} = 0
          else ${t.contentSha256} ~ '^[a-f0-9]{64}$' and ${t.failureReason} is null and ${t.missingCount} + ${t.hashMismatchCount} > 0
        end`,
      ),
      pgPolicy("retention_exports_tenant", {
        for: "all",
        to: appRuntimeRole,
        using: tenant,
        withCheck: tenant,
      }),
      pgPolicy("retention_exports_context", {
        as: "restrictive",
        for: "all",
        to: appRuntimeRole,
        using: visiblePgr,
        withCheck: visiblePgr,
      }),
      pgPolicy("retention_exports_actor", {
        as: "restrictive",
        for: "insert",
        to: appRuntimeRole,
        withCheck: sql`${t.exportedBy}=${actor}`,
      }),
    ];
  },
).enableRLS();
