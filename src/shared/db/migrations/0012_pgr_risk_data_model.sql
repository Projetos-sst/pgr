CREATE TYPE "public"."assessment_criterion" AS ENUM('qualitative', 'quantitative');--> statement-breakpoint
CREATE TYPE "public"."control_level" AS ENUM('elimination', 'collective_protection', 'administrative', 'ppe');--> statement-breakpoint
CREATE TYPE "public"."exposure_time" AS ENUM('lt_1h', '1_2h', '2_4h', '4_7h', 'gt_7h', 'eventual', 'intermittent', 'habitual');--> statement-breakpoint
CREATE TYPE "public"."measurement_unit" AS ENUM('qualitative_na', 'db_a', 'db_c', 'm_s2', 'ppm', 'mg_m3', 'f_cm3', 'celsius', 'percent', 'lux');--> statement-breakpoint
CREATE TYPE "public"."pgr_registration_type" AS ENUM('crm', 'crea', 'mte', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."risk_agent_type" AS ENUM('physical', 'chemical', 'biological', 'ergonomic', 'mechanical', 'accident', 'psychosocial');--> statement-breakpoint
CREATE TABLE "control_measures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"risk_id" uuid NOT NULL,
	"control_level" "control_level" NOT NULL,
	"applicable" boolean DEFAULT false NOT NULL,
	"justification" text,
	"monitoring" text,
	"action_what" text,
	"action_how" text,
	"action_tracking" text,
	"action_measurement" text,
	"action_responsible" text,
	"action_deadline" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_control_measures_org_risk_level" UNIQUE("org_id","risk_id","control_level")
);
--> statement-breakpoint
ALTER TABLE "control_measures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pgr" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"work_unit_id" uuid,
	"responsible" text,
	"registration_type" "pgr_registration_type" DEFAULT 'not_applicable' NOT NULL,
	"registration_number" text,
	"issued_at" date,
	"valid_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pgr" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pgr_ges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"pgr_id" uuid NOT NULL,
	"ges_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_pgr_ges_org_pgr_ges" UNIQUE("org_id","pgr_id","ges_id")
);
--> statement-breakpoint
ALTER TABLE "pgr_ges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pgr_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"pgr_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"revised_at" date DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_pgr_revisions_org_pgr_number" UNIQUE("org_id","pgr_id","revision_number")
);
--> statement-breakpoint
ALTER TABLE "pgr_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "risk_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"risk_id" uuid NOT NULL,
	"criterion" "assessment_criterion" NOT NULL,
	"probability" integer NOT NULL,
	"severity" integer NOT NULL,
	"risk_level" integer NOT NULL,
	"uncertainty_degree" smallint DEFAULT 0 NOT NULL,
	"tolerance_limit" text,
	"result" text,
	"assessed_at" date DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "risk_assessments_probability_check" CHECK (probability between 1 and 5),
	CONSTRAINT "risk_assessments_severity_check" CHECK (severity between 1 and 5),
	CONSTRAINT "risk_assessments_risk_level_range_check" CHECK (risk_level between 1 and 25),
	CONSTRAINT "risk_assessments_risk_level_coherence_check" CHECK (risk_level = probability * severity),
	CONSTRAINT "risk_assessments_uncertainty_degree_check" CHECK (uncertainty_degree between 0 and 2)
);
--> statement-breakpoint
ALTER TABLE "risk_assessments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"ges_id" uuid NOT NULL,
	"agent_type" "risk_agent_type" NOT NULL,
	"hazard" text,
	"description" text NOT NULL,
	"sources" text,
	"propagation" text,
	"exposure_time" "exposure_time",
	"possible_injuries" text,
	"noxious_agent_code" text,
	"measurement_unit" "measurement_unit",
	"concentration_intensity" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "risks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "control_measures" ADD CONSTRAINT "control_measures_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_measures" ADD CONSTRAINT "control_measures_risk_id_risks_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr" ADD CONSTRAINT "pgr_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr" ADD CONSTRAINT "pgr_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr" ADD CONSTRAINT "pgr_work_unit_id_work_units_id_fk" FOREIGN KEY ("work_unit_id") REFERENCES "public"."work_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_ges" ADD CONSTRAINT "pgr_ges_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_ges" ADD CONSTRAINT "pgr_ges_pgr_id_pgr_id_fk" FOREIGN KEY ("pgr_id") REFERENCES "public"."pgr"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_ges" ADD CONSTRAINT "pgr_ges_ges_id_ges_id_fk" FOREIGN KEY ("ges_id") REFERENCES "public"."ges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_revisions" ADD CONSTRAINT "pgr_revisions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_revisions" ADD CONSTRAINT "pgr_revisions_pgr_id_pgr_id_fk" FOREIGN KEY ("pgr_id") REFERENCES "public"."pgr"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_risk_id_risks_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risks" ADD CONSTRAINT "risks_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risks" ADD CONSTRAINT "risks_ges_id_ges_id_fk" FOREIGN KEY ("ges_id") REFERENCES "public"."ges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_control_measures_org_id" ON "control_measures" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_control_measures_risk_id" ON "control_measures" USING btree ("risk_id");--> statement-breakpoint
CREATE INDEX "idx_pgr_org_id" ON "pgr" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_pgr_company_id" ON "pgr" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_pgr_ges_org_id" ON "pgr_ges" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_pgr_ges_pgr_id" ON "pgr_ges" USING btree ("pgr_id");--> statement-breakpoint
CREATE INDEX "idx_pgr_ges_ges_id" ON "pgr_ges" USING btree ("ges_id");--> statement-breakpoint
CREATE INDEX "idx_pgr_revisions_org_id" ON "pgr_revisions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_pgr_revisions_pgr_id" ON "pgr_revisions" USING btree ("pgr_id");--> statement-breakpoint
CREATE INDEX "idx_risk_assessments_org_id" ON "risk_assessments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_risk_assessments_risk_id" ON "risk_assessments" USING btree ("risk_id");--> statement-breakpoint
CREATE INDEX "idx_risks_org_id" ON "risks" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_risks_ges_id" ON "risks" USING btree ("ges_id");--> statement-breakpoint
CREATE POLICY "control_measures_isolation" ON "control_measures" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "pgr_isolation" ON "pgr" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "pgr_ges_isolation" ON "pgr_ges" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "pgr_revisions_isolation" ON "pgr_revisions" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "risk_assessments_isolation" ON "risk_assessments" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "risks_isolation" ON "risks" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risks TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_assessments TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.control_measures TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_ges TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_revisions TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_risks ON public.risks;--> statement-breakpoint
CREATE TRIGGER set_updated_at_risks BEFORE UPDATE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_risk_assessments ON public.risk_assessments;--> statement-breakpoint
CREATE TRIGGER set_updated_at_risk_assessments BEFORE UPDATE ON public.risk_assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_control_measures ON public.control_measures;--> statement-breakpoint
CREATE TRIGGER set_updated_at_control_measures BEFORE UPDATE ON public.control_measures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_pgr ON public.pgr;--> statement-breakpoint
CREATE TRIGGER set_updated_at_pgr BEFORE UPDATE ON public.pgr
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_pgr_ges ON public.pgr_ges;--> statement-breakpoint
CREATE TRIGGER set_updated_at_pgr_ges BEFORE UPDATE ON public.pgr_ges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_pgr_revisions ON public.pgr_revisions;--> statement-breakpoint
CREATE TRIGGER set_updated_at_pgr_revisions BEFORE UPDATE ON public.pgr_revisions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
