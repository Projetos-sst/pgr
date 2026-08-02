CREATE TYPE "public"."exam_aptitude" AS ENUM('fit', 'fit_with_restrictions', 'unfit');--> statement-breakpoint
CREATE TYPE "public"."exam_type" AS ENUM('admissional', 'periodic', 'change_of_function', 'return_to_work', 'dismissal');--> statement-breakpoint
CREATE TABLE "health_exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"employee_id" uuid NOT NULL,
	"doctor_id" uuid,
	"exam_type" "exam_type" NOT NULL,
	"performed_at" date NOT NULL,
	"valid_until" date,
	"aptitude" "exam_aptitude" NOT NULL,
	"notes" text,
	"certificate_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "health_exams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "health_exams" ADD CONSTRAINT "health_exams_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_exams" ADD CONSTRAINT "health_exams_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_exams" ADD CONSTRAINT "health_exams_doctor_id_medicos_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."medicos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_health_exams_org_id" ON "health_exams" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_health_exams_employee_id" ON "health_exams" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_health_exams_doctor_id" ON "health_exams" USING btree ("doctor_id");--> statement-breakpoint
CREATE POLICY "health_exams_isolation" ON "health_exams" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_exams TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_health_exams ON public.health_exams;--> statement-breakpoint
CREATE TRIGGER set_updated_at_health_exams BEFORE UPDATE ON public.health_exams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();