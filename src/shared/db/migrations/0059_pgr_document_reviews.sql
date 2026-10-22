CREATE TABLE "pgr_review_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"sample_id" uuid NOT NULL,
	"status" text NOT NULL,
	"data" jsonb NOT NULL,
	"recorded_by" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pgr_review_decisions_status" CHECK ("pgr_review_decisions"."status" in ('accepted','changes_requested'))
);
--> statement-breakpoint
ALTER TABLE "pgr_review_decisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pgr_review_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"pgr_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"supersedes_sample_id" uuid,
	"snapshot" jsonb NOT NULL,
	"snapshot_sha256" text NOT NULL,
	"template_sha256" text NOT NULL,
	"file_sha256" text NOT NULL,
	"created_by" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_pgr_review_sample_context" UNIQUE("id","org_id","pgr_id")
);
--> statement-breakpoint
ALTER TABLE "pgr_review_samples" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pgr_review_decisions" ADD CONSTRAINT "pgr_review_decisions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_review_decisions" ADD CONSTRAINT "pgr_review_decisions_sample_id_pgr_review_samples_id_fk" FOREIGN KEY ("sample_id") REFERENCES "public"."pgr_review_samples"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_review_samples" ADD CONSTRAINT "pgr_review_samples_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_review_samples" ADD CONSTRAINT "pgr_review_samples_pgr_id_pgr_id_fk" FOREIGN KEY ("pgr_id") REFERENCES "public"."pgr"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_review_samples" ADD CONSTRAINT "pgr_review_samples_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_review_samples" ADD CONSTRAINT "pgr_review_samples_supersedes_sample_id_org_id_pgr_id_pgr_review_samples_id_org_id_pgr_id_fk" FOREIGN KEY ("supersedes_sample_id","org_id","pgr_id") REFERENCES "public"."pgr_review_samples"("id","org_id","pgr_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pgr_review_decisions" ON "pgr_review_decisions" USING btree ("org_id","sample_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_pgr_review_samples" ON "pgr_review_samples" USING btree ("org_id","pgr_id","created_at");--> statement-breakpoint
CREATE POLICY "pgr_review_decisions_tenant" ON "pgr_review_decisions" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "pgr_review_decisions_context" ON "pgr_review_decisions" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists(select 1 from public.pgr_review_samples s where s.id="pgr_review_decisions"."sample_id" and s.org_id="pgr_review_decisions"."org_id")) WITH CHECK (exists(select 1 from public.pgr_review_samples s where s.id="pgr_review_decisions"."sample_id" and s.org_id="pgr_review_decisions"."org_id"));--> statement-breakpoint
CREATE POLICY "pgr_review_decisions_owner" ON "pgr_review_decisions" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK (exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')) and "pgr_review_decisions"."recorded_by"=current_setting('app.current_actor',true));--> statement-breakpoint
CREATE POLICY "pgr_review_samples_tenant" ON "pgr_review_samples" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "pgr_review_samples_actor" ON "pgr_review_samples" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("pgr_review_samples"."created_by"=current_setting('app.current_actor',true));--> statement-breakpoint
CREATE POLICY "pgr_review_samples_context" ON "pgr_review_samples" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists(select 1 from public.pgr p where p.id="pgr_review_samples"."pgr_id" and p.org_id="pgr_review_samples"."org_id")) WITH CHECK (exists(select 1 from public.pgr p where p.id="pgr_review_samples"."pgr_id" and p.org_id="pgr_review_samples"."org_id") and exists(select 1 from public.documents d where d.id="pgr_review_samples"."document_id" and d.org_id="pgr_review_samples"."org_id" and d.related_entity_type='pgr' and d.related_entity_id="pgr_review_samples"."pgr_id"));
--> statement-breakpoint
GRANT SELECT, INSERT ON public.pgr_review_samples, public.pgr_review_decisions TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.pgr_review_samples, public.pgr_review_decisions FROM app_runtime;
