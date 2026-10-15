CREATE TYPE "public"."psychosocial_factor_status" AS ENUM('in_action', 'monitored', 'controlled');--> statement-breakpoint
CREATE TYPE "public"."psychosocial_risk_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE "psychosocial_risk_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"ges_id" uuid NOT NULL,
	"level" "psychosocial_risk_level" NOT NULL,
	"assessment_method" text,
	"status" "psychosocial_factor_status" DEFAULT 'monitored' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "psychosocial_risk_factors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "psychosocial_risk_factors" ADD CONSTRAINT "psychosocial_risk_factors_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychosocial_risk_factors" ADD CONSTRAINT "psychosocial_risk_factors_ges_id_ges_id_fk" FOREIGN KEY ("ges_id") REFERENCES "public"."ges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_psychosocial_risk_factors_org_id" ON "psychosocial_risk_factors" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_psychosocial_risk_factors_ges" ON "psychosocial_risk_factors" USING btree ("ges_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_psychosocial_risk_factors_org_number" ON "psychosocial_risk_factors" USING btree ("org_id","number");--> statement-breakpoint
CREATE POLICY "psychosocial_risk_factors_isolation" ON "psychosocial_risk_factors" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.psychosocial_risk_factors TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_psychosocial_risk_factors ON public.psychosocial_risk_factors;--> statement-breakpoint
CREATE TRIGGER set_updated_at_psychosocial_risk_factors BEFORE UPDATE ON public.psychosocial_risk_factors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();