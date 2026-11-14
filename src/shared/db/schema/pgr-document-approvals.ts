import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  bigint,
  timestamp,
  index,
  uniqueIndex,
  pgPolicy,
  check,
  unique,
  foreignKey,
} from "drizzle-orm/pg-core";
import type { ApprovalEventKind } from "@/shared/domains/pgr/document-approval";
import type { ProfessionalIdentity } from "@/shared/domains/professional-identity";
import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { pgr } from "./pgr";
import { documents } from "./documents";

const tenant = sql`org_id=current_setting('app.current_org',true)`;
const actor = sql`current_setting('app.current_actor',true)`;
const administrator = sql`exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=${actor} and m.role in ('owner','org:admin'))`;

export const pgrDocumentApprovals = pgTable(
  "pgr_document_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seq: bigint("seq", { mode: "number" }).notNull().generatedAlwaysAsIdentity(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    pgrId: uuid("pgr_id")
      .notNull()
      .references(() => pgr.id, { onDelete: "restrict" }),
    kind: text("kind").$type<ApprovalEventKind>().notNull(),
    assignmentId: uuid("assignment_id"),
    decisionId: uuid("decision_id"),
    supersedesIssueId: uuid("supersedes_issue_id"),
    cancelledIssueId: uuid("cancelled_issue_id"),
    authorUserId: text("author_user_id"),
    reviewerUserId: text("reviewer_user_id"),
    reviewerIdentity: jsonb("reviewer_identity").$type<ProfessionalIdentity>(),
    snapshotSha256: text("snapshot_sha256"),
    templateSha256: text("template_sha256"),
    fileSha256: text("file_sha256"),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "restrict",
    }),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>(),
    actor: text("actor").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => {
    const pgrOfRow = sql`p.id=${t.pgrId} and p.org_id=${t.orgId}`;
    const officeStaff = (userId: typeof t.actor | typeof t.reviewerUserId) =>
      sql`exists(select 1 from public.org_memberships m where m.org_id=${t.orgId} and m.user_id=${userId} and m.role in ('owner','org:admin','collaborator','org:member') and m.scoped_company_id is null)`;
    const assignment = sql`${administrator} and ${officeStaff(t.reviewerUserId)} and exists(select 1 from public.pgr p where ${pgrOfRow} and (p.created_by is null or p.created_by=${t.authorUserId}))`;
    const decision = sql`${t.actor}=${t.reviewerUserId} and ${officeStaff(t.reviewerUserId)} and exists(select 1 from public.pgr p where ${pgrOfRow} and p.created_by is distinct from ${t.actor} and (p.created_by is null or p.created_by=${t.authorUserId}))`;
    const issue = sql`${officeStaff(t.actor)} and exists(select 1 from public.documents doc where doc.id=${t.documentId} and doc.org_id=${t.orgId} and doc.related_entity_type='pgr' and doc.related_entity_id=${t.pgrId})`;
    return [
      index("idx_pgr_document_approvals").on(t.orgId, t.pgrId, t.seq),
      unique("uq_pgr_document_approval_context").on(t.id, t.orgId, t.pgrId),
      uniqueIndex("uq_pgr_document_approval_requirement")
        .on(t.orgId, t.pgrId)
        .where(sql`${t.kind}='required'`),
      uniqueIndex("uq_pgr_document_approval_cancellation")
        .on(t.cancelledIssueId)
        .where(sql`${t.kind}='issue_cancelled'`),
      foreignKey({
        name: "pgr_document_approvals_assignment_fk",
        columns: [t.assignmentId, t.orgId, t.pgrId],
        foreignColumns: [t.id, t.orgId, t.pgrId],
      }).onDelete("restrict"),
      foreignKey({
        name: "pgr_document_approvals_decision_fk",
        columns: [t.decisionId, t.orgId, t.pgrId],
        foreignColumns: [t.id, t.orgId, t.pgrId],
      }).onDelete("restrict"),
      foreignKey({
        name: "pgr_document_approvals_supersedes_fk",
        columns: [t.supersedesIssueId, t.orgId, t.pgrId],
        foreignColumns: [t.id, t.orgId, t.pgrId],
      }).onDelete("restrict"),
      foreignKey({
        name: "pgr_document_approvals_cancelled_fk",
        columns: [t.cancelledIssueId, t.orgId, t.pgrId],
        foreignColumns: [t.id, t.orgId, t.pgrId],
      }).onDelete("restrict"),
      check(
        "pgr_document_approvals_kind",
        sql`${t.kind} in ('required','assigned','revoked','approved','rejected','issued','issue_cancelled')`,
      ),
      check(
        "pgr_document_approvals_separate",
        sql`${t.authorUserId} <> ${t.reviewerUserId}`,
      ),
      check(
        "pgr_document_approvals_shape",
        sql`case ${t.kind}
          when 'required' then ${t.reason} is not null
          when 'assigned' then ${t.authorUserId} is not null and ${t.reviewerUserId} is not null and ${t.reviewerIdentity} is not null and ${t.reason} is not null
          when 'revoked' then ${t.assignmentId} is not null and ${t.reason} is not null
          when 'approved' then ${t.assignmentId} is not null and ${t.authorUserId} is not null and ${t.reviewerUserId} is not null and ${t.snapshotSha256} is not null and ${t.templateSha256} is not null
          when 'rejected' then ${t.assignmentId} is not null and ${t.authorUserId} is not null and ${t.reviewerUserId} is not null and ${t.snapshotSha256} is not null and ${t.templateSha256} is not null and ${t.reason} is not null
          when 'issued' then ${t.assignmentId} is not null and ${t.decisionId} is not null and ${t.documentId} is not null and ${t.fileSha256} is not null and ${t.snapshotSha256} is not null and ${t.templateSha256} is not null and ${t.snapshot} is not null
          when 'issue_cancelled' then ${t.cancelledIssueId} is not null and ${t.reason} is not null
        end`,
      ),
      pgPolicy("pgr_document_approvals_tenant", {
        for: "all",
        to: appRuntimeRole,
        using: tenant,
        withCheck: tenant,
      }),
      pgPolicy("pgr_document_approvals_context", {
        as: "restrictive",
        for: "all",
        to: appRuntimeRole,
        using: sql`exists(select 1 from public.pgr p where ${pgrOfRow})`,
        withCheck: sql`exists(select 1 from public.pgr p where ${pgrOfRow})`,
      }),
      pgPolicy("pgr_document_approvals_actor", {
        as: "restrictive",
        for: "insert",
        to: appRuntimeRole,
        withCheck: sql`${t.actor}=${actor}`,
      }),
      pgPolicy("pgr_document_approvals_rule", {
        as: "restrictive",
        for: "insert",
        to: appRuntimeRole,
        withCheck: sql`case
          when ${t.kind} in ('required','revoked','issue_cancelled') then ${administrator}
          when ${t.kind}='assigned' then ${assignment}
          when ${t.kind} in ('approved','rejected') then ${decision}
          when ${t.kind}='issued' then ${issue}
          else false
        end`,
      }),
    ];
  },
).enableRLS();
