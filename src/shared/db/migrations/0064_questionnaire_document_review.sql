CREATE TABLE "pgr_document_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"pgr_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"assignment_id" uuid,
	"sample_id" uuid,
	"author_user_id" text NOT NULL,
	"reviewer_user_id" text NOT NULL,
	"reviewer" jsonb NOT NULL,
	"status" text NOT NULL,
	"source_sha256" text,
	"template_sha256" text,
	"actor" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pgr_document_approval_separate" CHECK ("pgr_document_approvals"."author_user_id" <> "pgr_document_approvals"."reviewer_user_id"),
	CONSTRAINT "pgr_document_approval_shape" CHECK (("pgr_document_approvals"."kind"='assignment' and "pgr_document_approvals"."status"='pending' and "pgr_document_approvals"."assignment_id" is null and "pgr_document_approvals"."sample_id" is null) or ("pgr_document_approvals"."kind"='decision' and "pgr_document_approvals"."status" in ('accepted','changes_requested') and "pgr_document_approvals"."assignment_id" is not null and "pgr_document_approvals"."sample_id" is not null and "pgr_document_approvals"."source_sha256" is not null and "pgr_document_approvals"."template_sha256" is not null))
);
--> statement-breakpoint
ALTER TABLE "pgr_document_approvals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT ON public.pgr_document_approvals TO app_runtime;--> statement-breakpoint
ALTER TABLE "pgr_document_approvals" ADD CONSTRAINT "pgr_document_approvals_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_document_approvals" ADD CONSTRAINT "pgr_document_approvals_pgr_id_pgr_id_fk" FOREIGN KEY ("pgr_id") REFERENCES "public"."pgr"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_document_approvals" ADD CONSTRAINT "pgr_document_approvals_sample_id_pgr_review_samples_id_fk" FOREIGN KEY ("sample_id") REFERENCES "public"."pgr_review_samples"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pgr_document_approval_context" ON "pgr_document_approvals" USING btree ("org_id","pgr_id","created_at");--> statement-breakpoint
CREATE POLICY "pgr_document_approval_read" ON "pgr_document_approvals" AS PERMISSIVE FOR SELECT TO "app_runtime" USING ("pgr_document_approvals"."org_id"=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "pgr_document_approval_insert" ON "pgr_document_approvals" AS PERMISSIVE FOR INSERT TO "app_runtime" WITH CHECK (
    "pgr_document_approvals"."org_id"=current_setting('app.current_org',true) and "pgr_document_approvals"."actor"=current_setting('app.current_actor',true)
    and exists(select 1 from public.pgr p where p.id="pgr_document_approvals"."pgr_id" and p.org_id="pgr_document_approvals"."org_id" and (p.created_by is null or p.created_by="pgr_document_approvals"."author_user_id"))
    and exists(select 1 from public.org_memberships m where m.org_id="pgr_document_approvals"."org_id" and m.user_id="pgr_document_approvals"."reviewer_user_id" and m.role in ('owner','org:admin','collaborator','org:member') and m.scoped_company_id is null)
    and (("pgr_document_approvals"."kind"='assignment' and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) or ("pgr_document_approvals"."kind"='decision' and "pgr_document_approvals"."actor"="pgr_document_approvals"."reviewer_user_id"
      and "pgr_document_approvals"."assignment_id"=(select a.id from public.pgr_document_approvals a where a.org_id="pgr_document_approvals"."org_id" and a.pgr_id="pgr_document_approvals"."pgr_id" and a.kind='assignment' order by a.created_at desc,a.id desc limit 1)
      and exists(select 1 from public.pgr_document_approvals a where a.id="pgr_document_approvals"."assignment_id" and a.org_id="pgr_document_approvals"."org_id" and a.pgr_id="pgr_document_approvals"."pgr_id" and a.kind='assignment' and a.author_user_id="pgr_document_approvals"."author_user_id" and a.reviewer_user_id="pgr_document_approvals"."reviewer_user_id" and a.reviewer="pgr_document_approvals"."reviewer")
      and exists(select 1 from public.pgr_review_samples s where s.id="pgr_document_approvals"."sample_id" and s.org_id="pgr_document_approvals"."org_id" and s.pgr_id="pgr_document_approvals"."pgr_id" and s.created_by<>"pgr_document_approvals"."actor" and s.snapshot_sha256="pgr_document_approvals"."source_sha256" and s.template_sha256="pgr_document_approvals"."template_sha256"))));
