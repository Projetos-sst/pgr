CREATE TABLE "pcmso_interpretation_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"procedure_code" text NOT NULL,
	"other_description" text,
	"version" integer NOT NULL,
	"criteria" text NOT NULL,
	"conduct" text NOT NULL,
	"authored_by_medico_id" uuid NOT NULL,
	"authored_by_user" text NOT NULL,
	"authored_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_pcmso_interpretation_criteria_version" UNIQUE NULLS NOT DISTINCT("org_id","company_id","procedure_code","other_description","version"),
	CONSTRAINT "ck_pcmso_interpretation_criteria_code" CHECK ("pcmso_interpretation_criteria"."procedure_code" ~ '^[0-9]{4}$'),
	CONSTRAINT "ck_pcmso_interpretation_criteria_other" CHECK (("pcmso_interpretation_criteria"."procedure_code" = '9999') = ("pcmso_interpretation_criteria"."other_description" is not null)),
	CONSTRAINT "ck_pcmso_interpretation_criteria_version" CHECK ("pcmso_interpretation_criteria"."version" > 0),
	CONSTRAINT "ck_pcmso_interpretation_criteria_text" CHECK (length(btrim("pcmso_interpretation_criteria"."criteria")) > 0 and length(btrim("pcmso_interpretation_criteria"."conduct")) > 0)
);
--> statement-breakpoint
ALTER TABLE "pcmso_interpretation_criteria" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pcmso_interpretation_criteria" ADD CONSTRAINT "pcmso_interpretation_criteria_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pcmso_interpretation_criteria" ADD CONSTRAINT "pcmso_interpretation_criteria_company_id_org_id_companies_id_org_id_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pcmso_interpretation_criteria_company" ON "pcmso_interpretation_criteria" USING btree ("org_id","company_id","procedure_code");--> statement-breakpoint
CREATE POLICY "pcmso_interpretation_criteria_isolation" ON "pcmso_interpretation_criteria" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "pcmso_interpretation_criteria_module_access" ON "pcmso_interpretation_criteria" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "pcmso_interpretation_criteria"."org_id" and cm.company_id = "pcmso_interpretation_criteria"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "pcmso_interpretation_criteria"."org_id" and cm.company_id = "pcmso_interpretation_criteria"."company_id" and cm.module = 'medicine' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "pcmso_interpretation_criteria_insert" ON "pcmso_interpretation_criteria" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("pcmso_interpretation_criteria"."authored_by_user" = current_setting('app.current_actor', true) and exists (select 1 from public.pcmso_coordinator_assignments a
        join public.medico_user_links l on l.org_id = a.org_id and l.medico_id = a.medico_id and l.revoked_at is null
        join public.medicos m on m.id = a.medico_id and m.org_id = a.org_id and m.status = 'active'
        join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
        where a.org_id = "pcmso_interpretation_criteria"."org_id" and a.company_id = "pcmso_interpretation_criteria"."company_id" and a.ends_on is null
          and a.medico_id = "pcmso_interpretation_criteria"."authored_by_medico_id" and l.user_id = current_setting('app.current_actor', true)));--> statement-breakpoint
GRANT SELECT, INSERT ON public.pcmso_interpretation_criteria TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.pcmso_interpretation_criteria FROM app_runtime;