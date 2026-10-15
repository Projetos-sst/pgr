CREATE TYPE "public"."ergonomic_adequacy" AS ENUM('adequate', 'inadequate', 'not_applicable');--> statement-breakpoint
CREATE TABLE "ergonomic_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"risk_id" uuid NOT NULL,
	"posture" "ergonomic_adequacy",
	"posture_notes" text,
	"movements" "ergonomic_adequacy",
	"movements_notes" text,
	"physical_load" "ergonomic_adequacy",
	"physical_load_notes" text,
	"mental_load" "ergonomic_adequacy",
	"mental_load_notes" text,
	"work_organization" "ergonomic_adequacy",
	"work_organization_notes" text,
	"physical_environment" "ergonomic_adequacy",
	"physical_environment_notes" text,
	"method" text,
	"responsible" text,
	"assessed_at" date DEFAULT now() NOT NULL,
	"notes" text,
	"psychosocial_campaign_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ergonomic_evaluations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ergonomic_evaluations" ADD CONSTRAINT "ergonomic_evaluations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ergonomic_evaluations" ADD CONSTRAINT "ergonomic_evaluations_risk_id_risks_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ergonomic_evaluations" ADD CONSTRAINT "ergonomic_evaluations_psychosocial_campaign_id_psychosocial_campaigns_id_fk" FOREIGN KEY ("psychosocial_campaign_id") REFERENCES "public"."psychosocial_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ergonomic_evaluations_org_id" ON "ergonomic_evaluations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_ergonomic_evaluations_risk_id" ON "ergonomic_evaluations" USING btree ("risk_id");--> statement-breakpoint
CREATE INDEX "idx_ergonomic_evaluations_org_risk_assessed" ON "ergonomic_evaluations" USING btree ("org_id","risk_id","assessed_at");--> statement-breakpoint
CREATE INDEX "idx_ergonomic_evaluations_campaign" ON "ergonomic_evaluations" USING btree ("psychosocial_campaign_id");--> statement-breakpoint
CREATE POLICY "ergonomic_evaluations_isolation" ON "ergonomic_evaluations" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ergonomic_evaluations TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_ergonomic_evaluations ON public.ergonomic_evaluations;--> statement-breakpoint
CREATE TRIGGER set_updated_at_ergonomic_evaluations BEFORE UPDATE ON public.ergonomic_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
