CREATE TABLE "pgr_docx_text_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "pgr_docx_text_versions_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"org_id" text NOT NULL,
	"pgr_id" uuid NOT NULL,
	"overrides" jsonb NOT NULL,
	"texts_sha256" text NOT NULL,
	"reason" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pgr_docx_text_versions_sha256" CHECK ("pgr_docx_text_versions"."texts_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "pgr_docx_text_versions_reason" CHECK (btrim("pgr_docx_text_versions"."reason") <> '')
);
--> statement-breakpoint
ALTER TABLE "pgr_docx_text_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pgr_docx_text_versions" ADD CONSTRAINT "pgr_docx_text_versions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_docx_text_versions" ADD CONSTRAINT "pgr_docx_text_versions_pgr_id_pgr_id_fk" FOREIGN KEY ("pgr_id") REFERENCES "public"."pgr"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pgr_docx_text_versions" ON "pgr_docx_text_versions" USING btree ("org_id","pgr_id","seq");--> statement-breakpoint
CREATE POLICY "pgr_docx_text_versions_tenant" ON "pgr_docx_text_versions" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "pgr_docx_text_versions_context" ON "pgr_docx_text_versions" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists(select 1 from public.pgr p where p.id="pgr_docx_text_versions"."pgr_id" and p.org_id="pgr_docx_text_versions"."org_id")) WITH CHECK (exists(select 1 from public.pgr p where p.id="pgr_docx_text_versions"."pgr_id" and p.org_id="pgr_docx_text_versions"."org_id"));--> statement-breakpoint
CREATE POLICY "pgr_docx_text_versions_actor" ON "pgr_docx_text_versions" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("pgr_docx_text_versions"."created_by"=current_setting('app.current_actor',true));--> statement-breakpoint
GRANT SELECT, INSERT ON public.pgr_docx_text_versions TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.pgr_docx_text_versions FROM app_runtime;
