CREATE TYPE "public"."form_control_position" AS ENUM('top', 'bottom', 'both');--> statement-breakpoint
CREATE TABLE "form_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"form_type" text NOT NULL,
	"company_id" uuid,
	"frm_code" text NOT NULL,
	"revision" text NOT NULL,
	"issue_date" date NOT NULL,
	"non_conformity_number" text,
	"ges_id" uuid,
	"position" "form_control_position" DEFAULT 'top' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form_controls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "form_controls" ADD CONSTRAINT "form_controls_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_controls" ADD CONSTRAINT "form_controls_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_controls" ADD CONSTRAINT "form_controls_ges_id_ges_id_fk" FOREIGN KEY ("ges_id") REFERENCES "public"."ges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_form_controls_org_id" ON "form_controls" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_form_controls_company_id" ON "form_controls" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_form_controls_ges_id" ON "form_controls" USING btree ("ges_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_form_controls_org_frm_code" ON "form_controls" USING btree ("org_id","frm_code");--> statement-breakpoint
CREATE POLICY "form_controls_isolation" ON "form_controls" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_controls TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_form_controls ON public.form_controls;--> statement-breakpoint
CREATE TRIGGER set_updated_at_form_controls BEFORE UPDATE ON public.form_controls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();