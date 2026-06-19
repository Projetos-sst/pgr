CREATE TYPE "public"."category_type" AS ENUM('epi', 'machine');--> statement-breakpoint
CREATE TYPE "public"."employee_sex" AS ENUM('male', 'female', 'not_informed');--> statement-breakpoint
CREATE TYPE "public"."employee_status" AS ENUM('active', 'on_leave', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."marital_status" AS ENUM('single', 'married', 'divorced', 'widowed', 'stable_union');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"type" "category_type" NOT NULL,
	"name" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"ges_id" uuid,
	"job_role_id" uuid,
	"full_name" text NOT NULL,
	"cpf" text NOT NULL,
	"birth_date" date,
	"sex" "employee_sex",
	"marital_status" "marital_status",
	"phone" text,
	"email" text,
	"rg" text,
	"badge_number" text,
	"badge_valid_until" date,
	"registration" text,
	"blood_type" text,
	"admission_date" date,
	"dismissal_date" date,
	"zip_code" text,
	"street" text,
	"number" text,
	"complement" text,
	"district" text,
	"city" text,
	"state" text,
	"photo_path" text,
	"status" "employee_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ges_job_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"ges_id" uuid NOT NULL,
	"job_role_id" uuid NOT NULL,
	"worker_count" integer NOT NULL,
	"work_schedule" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ges_job_roles_worker_count_check" CHECK (worker_count > 0)
);
--> statement-breakpoint
ALTER TABLE "ges_job_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"work_unit_id" uuid NOT NULL,
	"name" text NOT NULL,
	"process_description" text,
	"construction_type" text,
	"ceiling_height" numeric,
	"floor" text,
	"roof" text,
	"lighting" text,
	"ventilation" text,
	"other_characteristics" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"cbo" text,
	"work_schedule" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "work_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contract_number" text,
	"description" text NOT NULL,
	"zip_code" text,
	"street" text,
	"number" text,
	"complement" text,
	"district" text,
	"city" text,
	"state" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "razao_social" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "nome_fantasia" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "cnae" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "main_activity" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "risk_grade" smallint;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_path" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "zip_code" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "street" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "number" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "complement" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "district" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_ges_id_ges_id_fk" FOREIGN KEY ("ges_id") REFERENCES "public"."ges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_job_role_id_job_roles_id_fk" FOREIGN KEY ("job_role_id") REFERENCES "public"."job_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ges_job_roles" ADD CONSTRAINT "ges_job_roles_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ges_job_roles" ADD CONSTRAINT "ges_job_roles_ges_id_ges_id_fk" FOREIGN KEY ("ges_id") REFERENCES "public"."ges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ges_job_roles" ADD CONSTRAINT "ges_job_roles_job_role_id_job_roles_id_fk" FOREIGN KEY ("job_role_id") REFERENCES "public"."job_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ges" ADD CONSTRAINT "ges_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ges" ADD CONSTRAINT "ges_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ges" ADD CONSTRAINT "ges_work_unit_id_work_units_id_fk" FOREIGN KEY ("work_unit_id") REFERENCES "public"."work_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_roles" ADD CONSTRAINT "job_roles_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_roles" ADD CONSTRAINT "job_roles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_units" ADD CONSTRAINT "work_units_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_units" ADD CONSTRAINT "work_units_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_categories_org_id" ON "categories" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_categories_org_type_name" ON "categories" USING btree ("org_id","type","name");--> statement-breakpoint
CREATE INDEX "idx_employees_org_id" ON "employees" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_employees_company_id" ON "employees" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_employees_ges_id" ON "employees" USING btree ("ges_id");--> statement-breakpoint
CREATE INDEX "idx_employees_job_role_id" ON "employees" USING btree ("job_role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_employees_org_cpf" ON "employees" USING btree ("org_id","cpf");--> statement-breakpoint
CREATE INDEX "idx_ges_job_roles_org_id" ON "ges_job_roles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_ges_job_roles_ges_id" ON "ges_job_roles" USING btree ("ges_id");--> statement-breakpoint
CREATE INDEX "idx_ges_job_roles_job_role_id" ON "ges_job_roles" USING btree ("job_role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ges_job_roles_org_ges_role" ON "ges_job_roles" USING btree ("org_id","ges_id","job_role_id");--> statement-breakpoint
CREATE INDEX "idx_ges_org_id" ON "ges" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_ges_company_id" ON "ges" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_ges_work_unit_id" ON "ges" USING btree ("work_unit_id");--> statement-breakpoint
CREATE INDEX "idx_job_roles_org_id" ON "job_roles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_job_roles_company_id" ON "job_roles" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_job_roles_org_company_title" ON "job_roles" USING btree ("org_id","company_id","title");--> statement-breakpoint
CREATE INDEX "idx_work_units_org_id" ON "work_units" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_work_units_company_id" ON "work_units" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_risk_grade_check" CHECK (risk_grade between 1 and 4);--> statement-breakpoint
CREATE POLICY "categories_isolation" ON "categories" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "employees_isolation" ON "employees" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "ges_job_roles_isolation" ON "ges_job_roles" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "ges_isolation" ON "ges" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "job_roles_isolation" ON "job_roles" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "work_units_isolation" ON "work_units" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_units TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ges TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_roles TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ges_job_roles TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_companies ON public.companies;--> statement-breakpoint
CREATE TRIGGER set_updated_at_companies BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_work_units ON public.work_units;--> statement-breakpoint
CREATE TRIGGER set_updated_at_work_units BEFORE UPDATE ON public.work_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_ges ON public.ges;--> statement-breakpoint
CREATE TRIGGER set_updated_at_ges BEFORE UPDATE ON public.ges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_job_roles ON public.job_roles;--> statement-breakpoint
CREATE TRIGGER set_updated_at_job_roles BEFORE UPDATE ON public.job_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_categories ON public.categories;--> statement-breakpoint
CREATE TRIGGER set_updated_at_categories BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_employees ON public.employees;--> statement-breakpoint
CREATE TRIGGER set_updated_at_employees BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_ges_job_roles ON public.ges_job_roles;--> statement-breakpoint
CREATE TRIGGER set_updated_at_ges_job_roles BEFORE UPDATE ON public.ges_job_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();