CREATE TABLE "pcmso_analytical_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'preview' NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"previous_report_id" uuid,
	"content" jsonb NOT NULL,
	"content_sha256" text NOT NULL,
	"authored_by_medico_id" uuid NOT NULL,
	"generated_by" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_pcmso_analytical_reports_version" UNIQUE("org_id","company_id","version"),
	CONSTRAINT "uq_pcmso_analytical_reports_identity" UNIQUE("id","org_id","company_id"),
	CONSTRAINT "ck_pcmso_analytical_reports_status" CHECK ("pcmso_analytical_reports"."status" = 'preview'),
	CONSTRAINT "ck_pcmso_analytical_reports_version" CHECK ("pcmso_analytical_reports"."version" > 0),
	CONSTRAINT "ck_pcmso_analytical_reports_period" CHECK ("pcmso_analytical_reports"."period_end" >= "pcmso_analytical_reports"."period_start"),
	CONSTRAINT "ck_pcmso_analytical_reports_hash" CHECK ("pcmso_analytical_reports"."content_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "pcmso_analytical_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pcmso_analytical_reports" ADD CONSTRAINT "pcmso_analytical_reports_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pcmso_analytical_reports" ADD CONSTRAINT "pcmso_analytical_reports_company_id_org_id_companies_id_org_id_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pcmso_analytical_reports" ADD CONSTRAINT "pcmso_analytical_reports_previous_report_id_org_id_company_id_pcmso_analytical_reports_id_org_id_company_id_fk" FOREIGN KEY ("previous_report_id","org_id","company_id") REFERENCES "public"."pcmso_analytical_reports"("id","org_id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pcmso_analytical_reports_company" ON "pcmso_analytical_reports" USING btree ("org_id","company_id","period_end");--> statement-breakpoint
CREATE POLICY "pcmso_analytical_reports_isolation" ON "pcmso_analytical_reports" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "pcmso_analytical_reports_module_access" ON "pcmso_analytical_reports" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "pcmso_analytical_reports"."org_id" and cm.company_id = "pcmso_analytical_reports"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "pcmso_analytical_reports"."org_id" and cm.company_id = "pcmso_analytical_reports"."company_id" and cm.module = 'medicine' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "pcmso_analytical_reports_insert" ON "pcmso_analytical_reports" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("pcmso_analytical_reports"."generated_by" = current_setting('app.current_actor', true) and exists (select 1 from public.pcmso_coordinator_assignments a
        join public.medico_user_links l on l.org_id = a.org_id and l.medico_id = a.medico_id and l.revoked_at is null
        join public.medicos m on m.id = a.medico_id and m.org_id = a.org_id and m.status = 'active'
        join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
        where a.org_id = "pcmso_analytical_reports"."org_id" and a.company_id = "pcmso_analytical_reports"."company_id" and a.ends_on is null
          and a.medico_id = "pcmso_analytical_reports"."authored_by_medico_id" and l.user_id = current_setting('app.current_actor', true)));--> statement-breakpoint
GRANT SELECT, INSERT ON public.pcmso_analytical_reports TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.pcmso_analytical_reports FROM app_runtime;