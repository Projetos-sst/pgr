CREATE TYPE "public"."psychosocial_campaign_status" AS ENUM('draft', 'active', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."psychosocial_question_type" AS ENUM('likert', 'multiple_choice', 'free_text');--> statement-breakpoint
CREATE TABLE "psychosocial_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"response_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"value_int" integer,
	"value_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "psychosocial_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "psychosocial_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"work_unit_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_at" date,
	"ends_at" date,
	"theme_color" text,
	"cover_path" text,
	"worker_description" text,
	"status" "psychosocial_campaign_status" DEFAULT 'draft' NOT NULL,
	"public_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "psychosocial_campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "psychosocial_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"campaign_id" uuid NOT NULL,
	"text" text NOT NULL,
	"question_type" "psychosocial_question_type" NOT NULL,
	"options" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "psychosocial_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "psychosocial_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"campaign_id" uuid NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "psychosocial_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "psychosocial_risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"campaign_id" uuid NOT NULL,
	"factor" text NOT NULL,
	"level" integer NOT NULL,
	"description" text,
	"source_question_id" uuid,
	"risk_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "psychosocial_risks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "psychosocial_answers" ADD CONSTRAINT "psychosocial_answers_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychosocial_answers" ADD CONSTRAINT "psychosocial_answers_response_id_psychosocial_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."psychosocial_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychosocial_answers" ADD CONSTRAINT "psychosocial_answers_question_id_psychosocial_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."psychosocial_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychosocial_campaigns" ADD CONSTRAINT "psychosocial_campaigns_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychosocial_campaigns" ADD CONSTRAINT "psychosocial_campaigns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychosocial_campaigns" ADD CONSTRAINT "psychosocial_campaigns_work_unit_id_work_units_id_fk" FOREIGN KEY ("work_unit_id") REFERENCES "public"."work_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychosocial_questions" ADD CONSTRAINT "psychosocial_questions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychosocial_questions" ADD CONSTRAINT "psychosocial_questions_campaign_id_psychosocial_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."psychosocial_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychosocial_responses" ADD CONSTRAINT "psychosocial_responses_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychosocial_responses" ADD CONSTRAINT "psychosocial_responses_campaign_id_psychosocial_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."psychosocial_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychosocial_risks" ADD CONSTRAINT "psychosocial_risks_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychosocial_risks" ADD CONSTRAINT "psychosocial_risks_campaign_id_psychosocial_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."psychosocial_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychosocial_risks" ADD CONSTRAINT "psychosocial_risks_source_question_id_psychosocial_questions_id_fk" FOREIGN KEY ("source_question_id") REFERENCES "public"."psychosocial_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychosocial_risks" ADD CONSTRAINT "psychosocial_risks_risk_id_risks_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_psychosocial_answers_org_id" ON "psychosocial_answers" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_psychosocial_answers_response" ON "psychosocial_answers" USING btree ("response_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_psychosocial_answers_response_question" ON "psychosocial_answers" USING btree ("response_id","question_id");--> statement-breakpoint
CREATE INDEX "idx_psychosocial_campaigns_org_id" ON "psychosocial_campaigns" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_psychosocial_campaigns_work_unit" ON "psychosocial_campaigns" USING btree ("work_unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_psychosocial_campaigns_public_token" ON "psychosocial_campaigns" USING btree ("public_token");--> statement-breakpoint
CREATE INDEX "idx_psychosocial_questions_org_id" ON "psychosocial_questions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_psychosocial_questions_campaign" ON "psychosocial_questions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_psychosocial_responses_org_id" ON "psychosocial_responses" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_psychosocial_responses_campaign" ON "psychosocial_responses" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_psychosocial_responses_token" ON "psychosocial_responses" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_psychosocial_risks_org_id" ON "psychosocial_risks" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_psychosocial_risks_campaign" ON "psychosocial_risks" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_psychosocial_risks_campaign_factor" ON "psychosocial_risks" USING btree ("org_id","campaign_id","factor");--> statement-breakpoint
CREATE POLICY "psychosocial_answers_isolation" ON "psychosocial_answers" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "psychosocial_campaigns_isolation" ON "psychosocial_campaigns" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "psychosocial_campaigns_token_read" ON "psychosocial_campaigns" AS PERMISSIVE FOR SELECT TO "app_runtime" USING (public_token = current_setting('app.psychosocial_token', true));--> statement-breakpoint
CREATE POLICY "psychosocial_questions_isolation" ON "psychosocial_questions" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "psychosocial_responses_isolation" ON "psychosocial_responses" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "psychosocial_risks_isolation" ON "psychosocial_risks" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.psychosocial_campaigns TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.psychosocial_questions TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.psychosocial_responses TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.psychosocial_answers TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.psychosocial_risks TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_psychosocial_campaigns ON public.psychosocial_campaigns;--> statement-breakpoint
CREATE TRIGGER set_updated_at_psychosocial_campaigns BEFORE UPDATE ON public.psychosocial_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_psychosocial_questions ON public.psychosocial_questions;--> statement-breakpoint
CREATE TRIGGER set_updated_at_psychosocial_questions BEFORE UPDATE ON public.psychosocial_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_psychosocial_risks ON public.psychosocial_risks;--> statement-breakpoint
CREATE TRIGGER set_updated_at_psychosocial_risks BEFORE UPDATE ON public.psychosocial_risks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
