CREATE TYPE "public"."methodology_base" AS ENUM('aiha', 'as_nzs_4360', 'fundacentro', 'custom');--> statement-breakpoint
CREATE TYPE "public"."risk_classification" AS ENUM('trivial', 'tolerable', 'moderate', 'substantial', 'intolerable');--> statement-breakpoint
CREATE TABLE "risk_methodology" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"base" "methodology_base" NOT NULL,
	"probability_grades" jsonb NOT NULL,
	"severity_grades" jsonb NOT NULL,
	"classification_bands" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_risk_methodology_org" UNIQUE("org_id")
);
--> statement-breakpoint
ALTER TABLE "risk_methodology" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "risk_methodology" ADD CONSTRAINT "risk_methodology_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "risk_methodology_isolation" ON "risk_methodology" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_methodology TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_risk_methodology ON public.risk_methodology;--> statement-breakpoint
CREATE TRIGGER set_updated_at_risk_methodology BEFORE UPDATE ON public.risk_methodology
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();