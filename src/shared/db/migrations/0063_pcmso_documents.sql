CREATE TABLE "pcmso_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'preview' NOT NULL,
	"validity_start" date NOT NULL,
	"validity_end" date NOT NULL,
	"exam_plan_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"content_sha256" text NOT NULL,
	"generated_by" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_pcmso_documents_version" UNIQUE("org_id","company_id","version"),
	CONSTRAINT "ck_pcmso_documents_status" CHECK ("pcmso_documents"."status" = 'preview'),
	CONSTRAINT "ck_pcmso_documents_version" CHECK ("pcmso_documents"."version" > 0),
	CONSTRAINT "ck_pcmso_documents_validity" CHECK ("pcmso_documents"."validity_end" > "pcmso_documents"."validity_start"),
	CONSTRAINT "ck_pcmso_documents_hash" CHECK ("pcmso_documents"."content_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "pcmso_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pcmso_documents" ADD CONSTRAINT "pcmso_documents_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pcmso_documents" ADD CONSTRAINT "pcmso_documents_company_id_org_id_companies_id_org_id_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pcmso_documents" ADD CONSTRAINT "pcmso_documents_exam_plan_id_org_id_company_id_medical_exam_plans_id_org_id_company_id_fk" FOREIGN KEY ("exam_plan_id","org_id","company_id") REFERENCES "public"."medical_exam_plans"("id","org_id","company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pcmso_documents_company" ON "pcmso_documents" USING btree ("org_id","company_id","version");--> statement-breakpoint
CREATE POLICY "pcmso_documents_isolation" ON "pcmso_documents" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "pcmso_documents_module_access" ON "pcmso_documents" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "pcmso_documents"."org_id" and cm.company_id = "pcmso_documents"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "pcmso_documents"."org_id" and cm.company_id = "pcmso_documents"."company_id" and cm.module = 'medicine' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "pcmso_documents_insert" ON "pcmso_documents" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("pcmso_documents"."generated_by" = current_setting('app.current_actor', true) and exists (select 1 from public.medical_exam_plans p where p.id = "pcmso_documents"."exam_plan_id" and p.org_id = "pcmso_documents"."org_id" and p.company_id = "pcmso_documents"."company_id" and p.status = 'approved'));--> statement-breakpoint
GRANT SELECT, INSERT ON public.pcmso_documents TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.pcmso_documents FROM app_runtime;
