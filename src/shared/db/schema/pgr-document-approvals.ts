import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgPolicy,
  check,
  index,
} from "drizzle-orm/pg-core";
import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { pgr } from "./pgr";
import { pgrReviewSamples } from "./pgr-document-reviews";
import type { ProfessionalIdentity } from "@/shared/domains/professional-identity";
import { documentReviewReadScope } from "./document-review-policy";
const actor = sql`current_setting('app.current_actor',true)`;
const owner = sql`exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=${actor} and m.role in ('owner','org:admin'))`;
/** Immutable designation and per-document decisions; generator sample opinions remain separate. */
export const pgrDocumentApprovals = pgTable(
  "pgr_document_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    pgrId: uuid("pgr_id")
      .notNull()
      .references(() => pgr.id, { onDelete: "restrict" }),
    kind: text("kind").$type<"assignment" | "decision">().notNull(),
    assignmentId: uuid("assignment_id"),
    sampleId: uuid("sample_id").references(() => pgrReviewSamples.id, {
      onDelete: "restrict",
    }),
    authorUserId: text("author_user_id").notNull(),
    reviewerUserId: text("reviewer_user_id").notNull(),
    reviewer: jsonb("reviewer").$type<ProfessionalIdentity>().notNull(),
    status: text("status")
      .$type<"pending" | "accepted" | "changes_requested">()
      .notNull(),
    sourceSha256: text("source_sha256"),
    templateSha256: text("template_sha256"),
    actor: text("actor").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_pgr_document_approval_context").on(t.orgId, t.pgrId, t.createdAt),
    check(
      "pgr_document_approval_separate",
      sql`${t.authorUserId} <> ${t.reviewerUserId}`,
    ),
    check(
      "pgr_document_approval_shape",
      sql`(${t.kind}='assignment' and ${t.status}='pending' and ${t.assignmentId} is null and ${t.sampleId} is null) or (${t.kind}='decision' and ${t.status} in ('accepted','changes_requested') and ${t.assignmentId} is not null and ${t.sampleId} is not null and ${t.sourceSha256} is not null and ${t.templateSha256} is not null)`,
    ),
    pgPolicy("pgr_document_approval_read", {
      for: "select",
      to: appRuntimeRole,
      using: sql`${t.orgId}=current_setting('app.current_org',true)`,
    }),
    pgPolicy("pgr_document_approval_actor_read", {
      as: "restrictive",
      for: "select",
      to: appRuntimeRole,
      using: documentReviewReadScope(t.orgId, t.pgrId),
    }),
    pgPolicy("pgr_document_approval_insert", {
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`
    ${t.orgId}=current_setting('app.current_org',true) and ${t.actor}=${actor}
    and exists(select 1 from public.pgr p where p.id=${t.pgrId} and p.org_id=${t.orgId} and (p.created_by is null or p.created_by=${t.authorUserId}))
    and exists(select 1 from public.org_memberships m where m.org_id=${t.orgId} and m.user_id=${t.reviewerUserId} and ((m.role in ('owner','org:admin','collaborator','org:member') and m.scoped_company_id is null) or (m.role in ('client','org:client') and m.scoped_company_id=(select p.company_id from public.pgr p where p.id=${t.pgrId} and p.org_id=${t.orgId}))))
    and ((${t.kind}='assignment' and ${owner}) or (${t.kind}='decision' and ${t.actor}=${t.reviewerUserId}
      and ${t.assignmentId}=(select a.id from public.pgr_document_approvals a where a.org_id=${t.orgId} and a.pgr_id=${t.pgrId} and a.kind='assignment' order by a.created_at desc,a.id desc limit 1)
      and exists(select 1 from public.pgr_document_approvals a where a.id=${t.assignmentId} and a.org_id=${t.orgId} and a.pgr_id=${t.pgrId} and a.kind='assignment' and a.author_user_id=${t.authorUserId} and a.reviewer_user_id=${t.reviewerUserId} and a.reviewer=${t.reviewer})
      and exists(select 1 from public.pgr_review_samples s where s.id=${t.sampleId} and s.org_id=${t.orgId} and s.pgr_id=${t.pgrId} and s.created_by<>${t.actor} and s.snapshot_sha256=${t.sourceSha256} and s.template_sha256=${t.templateSha256})))`,
    }),
  ],
).enableRLS();
