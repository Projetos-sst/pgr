CREATE UNIQUE INDEX "uq_companies_id_org" ON "companies" USING btree ("id","org_id");--> statement-breakpoint
CREATE TABLE "company_module_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"module" text NOT NULL,
	"previous_enabled" boolean NOT NULL,
	"enabled" boolean NOT NULL,
	"changed_by" text NOT NULL,
	"reason" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_module_events_module_check" CHECK ("company_module_events"."module" in ('pgr', 'medicine'))
);
--> statement-breakpoint
ALTER TABLE "company_module_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "company_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"module" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_company_modules_company_module" UNIQUE("org_id","company_id","module"),
	CONSTRAINT "company_modules_module_check" CHECK ("company_modules"."module" in ('pgr', 'medicine'))
);
--> statement-breakpoint
ALTER TABLE "company_modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_module_events" ADD CONSTRAINT "company_module_events_company_id_org_id_companies_id_org_id_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_company_id_org_id_companies_id_org_id_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_company_module_events_company" ON "company_module_events" USING btree ("org_id","company_id");--> statement-breakpoint

CREATE POLICY "health_exams_module_access" ON "health_exams" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.employees e where e.id = "health_exams"."employee_id" and e.org_id = "health_exams"."org_id" and exists (select 1 from public.company_modules cm where cm.org_id = "health_exams"."org_id" and cm.company_id = e.company_id and cm.module = 'medicine' and cm.enabled = true))) WITH CHECK (exists (select 1 from public.employees e where e.id = "health_exams"."employee_id" and e.org_id = "health_exams"."org_id" and exists (select 1 from public.company_modules cm where cm.org_id = "health_exams"."org_id" and cm.company_id = e.company_id and cm.module = 'medicine' and cm.enabled = true)));--> statement-breakpoint
CREATE POLICY "pgr_module_access" ON "pgr" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "pgr"."org_id" and cm.company_id = "pgr"."company_id" and cm.module = 'pgr' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "pgr"."org_id" and cm.company_id = "pgr"."company_id" and cm.module = 'pgr' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "pgr_ges_module_access" ON "pgr_ges" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.pgr parent where parent.id = "pgr_ges"."pgr_id" and parent.org_id = "pgr_ges"."org_id")) WITH CHECK (exists (select 1 from public.pgr parent where parent.id = "pgr_ges"."pgr_id" and parent.org_id = "pgr_ges"."org_id"));--> statement-breakpoint
CREATE POLICY "pgr_revisions_module_access" ON "pgr_revisions" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.pgr parent where parent.id = "pgr_revisions"."pgr_id" and parent.org_id = "pgr_revisions"."org_id")) WITH CHECK (exists (select 1 from public.pgr parent where parent.id = "pgr_revisions"."pgr_id" and parent.org_id = "pgr_revisions"."org_id"));--> statement-breakpoint
CREATE POLICY "company_module_events_isolation" ON "company_module_events" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "company_modules_isolation" ON "company_modules" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.company_modules TO app_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.company_module_events TO app_runtime;
--> statement-breakpoint
INSERT INTO public.company_modules (org_id, company_id, module, enabled)
SELECT c.org_id, c.id, m.module, true FROM public.companies c
CROSS JOIN (VALUES ('pgr'), ('medicine')) AS m(module);
--> statement-breakpoint
INSERT INTO public.company_module_events (org_id, company_id, module, previous_enabled, enabled, changed_by, reason)
SELECT org_id, company_id, module, true, true, 'migration:0053', 'Preservacao dos acessos existentes' FROM public.company_modules;
