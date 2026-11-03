CREATE TABLE "medical_risk_absence_declarations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"ges_id" uuid NOT NULL,
	"exposure_group" text NOT NULL,
	"job_role" text DEFAULT '' NOT NULL,
	"justification" text NOT NULL,
	"declared_by" text NOT NULL,
	"declared_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_risk_absence_scope" UNIQUE("org_id","source_id","ges_id","job_role"),
	CONSTRAINT "ck_risk_absence_justification" CHECK (char_length(btrim("medical_risk_absence_declarations"."justification")) >= 20),
	CONSTRAINT "ck_risk_absence_job_role" CHECK ("medical_risk_absence_declarations"."job_role" = btrim("medical_risk_absence_declarations"."job_role"))
);
--> statement-breakpoint
ALTER TABLE "medical_risk_absence_declarations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "medical_risk_absence_declarations" ADD CONSTRAINT "fk_risk_absence_company" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_risk_absence_declarations" ADD CONSTRAINT "fk_risk_absence_source" FOREIGN KEY ("source_id","org_id","company_id") REFERENCES "public"."medical_risk_sources"("id","org_id","company_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_risk_absence_company" ON "medical_risk_absence_declarations" USING btree ("org_id","company_id","declared_at");--> statement-breakpoint
CREATE POLICY "risk_absence_isolation" ON "medical_risk_absence_declarations" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "risk_absence_module_access" ON "medical_risk_absence_declarations" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "medical_risk_absence_declarations"."org_id" and cm.company_id = "medical_risk_absence_declarations"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "medical_risk_absence_declarations"."org_id" and cm.company_id = "medical_risk_absence_declarations"."company_id" and cm.module = 'medicine' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "risk_absence_authorized_insert" ON "medical_risk_absence_declarations" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("medical_risk_absence_declarations"."declared_by" = current_setting('app.current_actor', true) and exists (select 1 from public.professional_risk_authorizations a
        join public.org_memberships om on om.org_id = a.org_id and om.user_id = a.user_id
        where a.org_id = "medical_risk_absence_declarations"."org_id" and a.company_id = "medical_risk_absence_declarations"."company_id" and a.user_id = current_setting('app.current_actor', true) and a.active = true
          and (om.scoped_company_id is null or om.scoped_company_id = "medical_risk_absence_declarations"."company_id")));--> statement-breakpoint
GRANT SELECT, INSERT ON public.medical_risk_absence_declarations TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.medical_risk_absence_declarations FROM app_runtime;