-- NOB-152 (MED-07): empresa onde o exame foi realizado. Backfill pelo vínculo atual do funcionário
-- (até aqui o exame seguia o funcionário); depois NOT NULL e identidade composta para as FKs.
ALTER TABLE "health_exams" ADD COLUMN "company_id" uuid;
--> statement-breakpoint
-- O backfill não é edição do exame: o trigger de updated_at fica desligado só durante o UPDATE.
ALTER TABLE "health_exams" DISABLE TRIGGER "set_updated_at_health_exams";
--> statement-breakpoint
UPDATE "health_exams" h SET "company_id" = e."company_id" FROM "employees" e WHERE e."id" = h."employee_id" AND e."org_id" = h."org_id";
--> statement-breakpoint
ALTER TABLE "health_exams" ENABLE TRIGGER "set_updated_at_health_exams";
--> statement-breakpoint
ALTER TABLE "health_exams" ALTER COLUMN "company_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "health_exams" ADD CONSTRAINT "uq_health_exams_identity" UNIQUE("id","org_id","company_id");
--> statement-breakpoint
CREATE TABLE "aso_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"health_exam_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'preview' NOT NULL,
	"content" jsonb NOT NULL,
	"content_sha256" text NOT NULL,
	"generated_by" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_aso_documents_version" UNIQUE("org_id","health_exam_id","version"),
	CONSTRAINT "ck_aso_documents_status" CHECK ("aso_documents"."status" = 'preview'),
	CONSTRAINT "ck_aso_documents_version" CHECK ("aso_documents"."version" > 0),
	CONSTRAINT "ck_aso_documents_hash" CHECK ("aso_documents"."content_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "aso_documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "health_exam_procedures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"health_exam_id" uuid NOT NULL,
	"procedure_code" text NOT NULL,
	"other_description" text,
	"performed_at" date NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_health_exam_procedures" UNIQUE NULLS NOT DISTINCT("org_id","health_exam_id","procedure_code","performed_at","other_description"),
	CONSTRAINT "ck_health_exam_procedures_code" CHECK ("health_exam_procedures"."procedure_code" ~ '^[0-9]{4}$'),
	CONSTRAINT "ck_health_exam_procedures_other" CHECK (("health_exam_procedures"."procedure_code" = '9999') = ("health_exam_procedures"."other_description" is not null))
);
--> statement-breakpoint
ALTER TABLE "health_exam_procedures" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "aso_documents" ADD CONSTRAINT "aso_documents_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "aso_documents" ADD CONSTRAINT "aso_documents_company_id_org_id_companies_id_org_id_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "aso_documents" ADD CONSTRAINT "aso_documents_health_exam_id_org_id_company_id_health_exams_id_org_id_company_id_fk" FOREIGN KEY ("health_exam_id","org_id","company_id") REFERENCES "public"."health_exams"("id","org_id","company_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "health_exam_procedures" ADD CONSTRAINT "health_exam_procedures_health_exam_id_org_id_company_id_health_exams_id_org_id_company_id_fk" FOREIGN KEY ("health_exam_id","org_id","company_id") REFERENCES "public"."health_exams"("id","org_id","company_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_aso_documents_exam" ON "aso_documents" USING btree ("org_id","health_exam_id","version");
--> statement-breakpoint
CREATE INDEX "idx_health_exam_procedures_exam" ON "health_exam_procedures" USING btree ("org_id","health_exam_id");
--> statement-breakpoint
ALTER TABLE "health_exams" ADD CONSTRAINT "health_exams_company_id_org_id_companies_id_org_id_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_health_exams_company_id" ON "health_exams" USING btree ("org_id","company_id");
--> statement-breakpoint
CREATE POLICY "aso_documents_isolation" ON "aso_documents" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));
--> statement-breakpoint
CREATE POLICY "aso_documents_module_access" ON "aso_documents" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "aso_documents"."org_id" and cm.company_id = "aso_documents"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "aso_documents"."org_id" and cm.company_id = "aso_documents"."company_id" and cm.module = 'medicine' and cm.enabled = true));
--> statement-breakpoint
CREATE POLICY "aso_documents_insert" ON "aso_documents" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("aso_documents"."generated_by" = current_setting('app.current_actor', true) and exists (select 1 from public.health_exams h where h.id = "aso_documents"."health_exam_id" and h.org_id = "aso_documents"."org_id" and h.company_id = "aso_documents"."company_id" and h.doctor_id is not null));
--> statement-breakpoint
CREATE POLICY "health_exam_procedures_isolation" ON "health_exam_procedures" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));
--> statement-breakpoint
CREATE POLICY "health_exam_procedures_module_access" ON "health_exam_procedures" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "health_exam_procedures"."org_id" and cm.company_id = "health_exam_procedures"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "health_exam_procedures"."org_id" and cm.company_id = "health_exam_procedures"."company_id" and cm.module = 'medicine' and cm.enabled = true));
--> statement-breakpoint
CREATE POLICY "health_exam_procedures_insert" ON "health_exam_procedures" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("health_exam_procedures"."created_by" = current_setting('app.current_actor', true));
--> statement-breakpoint
-- Sem company_id no INSERT, o banco usa a empresa atual do funcionário do mesmo tenant.
CREATE OR REPLACE FUNCTION public.health_exams_set_company() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT e.company_id INTO NEW.company_id FROM public.employees e WHERE e.id = NEW.employee_id AND e.org_id = NEW.org_id;
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER health_exams_set_company BEFORE INSERT ON public.health_exams FOR EACH ROW EXECUTE FUNCTION public.health_exams_set_company();
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.health_exam_procedures TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE ON public.health_exam_procedures FROM app_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.aso_documents TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.aso_documents FROM app_runtime;