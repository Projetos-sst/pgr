CREATE TYPE "public"."training_periodicity" AS ENUM('annual', 'biennial', 'triennial', 'quinquennial', 'single');--> statement-breakpoint
CREATE TABLE "job_role_required_trainings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"job_role_id" uuid NOT NULL,
	"training_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_role_required_trainings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "training_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"reference_norm" text,
	"workload_hours" integer NOT NULL,
	"periodicity" "training_periodicity" NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_catalog_workload_hours_check" CHECK (workload_hours > 0)
);
--> statement-breakpoint
ALTER TABLE "training_catalog" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "training_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"employee_id" uuid NOT NULL,
	"training_id" uuid NOT NULL,
	"completed_at" date NOT NULL,
	"valid_until" date,
	"certificate_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "job_role_required_trainings" ADD CONSTRAINT "job_role_required_trainings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_role_required_trainings" ADD CONSTRAINT "job_role_required_trainings_job_role_id_job_roles_id_fk" FOREIGN KEY ("job_role_id") REFERENCES "public"."job_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_role_required_trainings" ADD CONSTRAINT "job_role_required_trainings_training_id_training_catalog_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."training_catalog"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_catalog" ADD CONSTRAINT "training_catalog_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_training_id_training_catalog_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."training_catalog"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_job_role_required_trainings_org_id" ON "job_role_required_trainings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_job_role_required_trainings_job_role_id" ON "job_role_required_trainings" USING btree ("job_role_id");--> statement-breakpoint
CREATE INDEX "idx_job_role_required_trainings_training_id" ON "job_role_required_trainings" USING btree ("training_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_job_role_required_trainings_org_role_training" ON "job_role_required_trainings" USING btree ("org_id","job_role_id","training_id");--> statement-breakpoint
CREATE INDEX "idx_training_catalog_org_id" ON "training_catalog" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_training_catalog_org_name" ON "training_catalog" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "idx_training_records_org_id" ON "training_records" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_training_records_employee_id" ON "training_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_training_records_training_id" ON "training_records" USING btree ("training_id");--> statement-breakpoint
CREATE POLICY "job_role_required_trainings_isolation" ON "job_role_required_trainings" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "training_catalog_isolation" ON "training_catalog" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "training_records_isolation" ON "training_records" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_catalog TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_records TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_role_required_trainings TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_training_catalog ON public.training_catalog;--> statement-breakpoint
CREATE TRIGGER set_updated_at_training_catalog BEFORE UPDATE ON public.training_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_training_records ON public.training_records;--> statement-breakpoint
CREATE TRIGGER set_updated_at_training_records BEFORE UPDATE ON public.training_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_job_role_required_trainings ON public.job_role_required_trainings;--> statement-breakpoint
CREATE TRIGGER set_updated_at_job_role_required_trainings BEFORE UPDATE ON public.job_role_required_trainings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();