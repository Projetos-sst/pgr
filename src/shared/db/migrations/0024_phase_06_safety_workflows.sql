-- Historical compatibility prelude (Feature 023 reconciliation).
-- Reproduces, IDEMPOTENTLY, the DDL of the two orphan 0018 files that are NOT in
-- _journal.json (0018_org_billing.sql + 0018_user_is_master.sql), so a fresh
-- journal-based `drizzle-kit migrate` reaches the same schema as an existing/glob DB.
-- IF NOT EXISTS → no-op on databases where these already exist (prod/glob).
ALTER TABLE "orgs" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orgs_stripe_customer_id_unique" ON "orgs" USING btree ("stripe_customer_id");--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_master" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Feature 023: Phase 06 safety workflows
CREATE TYPE "public"."accident_category" AS ENUM('with_leave', 'without_leave', 'fatal');--> statement-breakpoint
CREATE TYPE "public"."accident_severity" AS ENUM('minor', 'moderate', 'severe', 'fatal');--> statement-breakpoint
CREATE TYPE "public"."accident_status" AS ENUM('registered', 'awaiting_planning', 'awaiting_completion', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."accident_type" AS ENUM('typical', 'commute', 'occupational_disease');--> statement-breakpoint
CREATE TYPE "public"."action_plan_status" AS ENUM('planned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."risk_audit_status" AS ENUM('awaiting_analysis', 'planning_actions', 'completed');--> statement-breakpoint
CREATE TYPE "public"."service_order_status" AS ENUM('open', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "accidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid,
	"occurred_at" timestamp with time zone NOT NULL,
	"type" "accident_type" NOT NULL,
	"category" "accident_category" NOT NULL,
	"severity" "accident_severity" NOT NULL,
	"status" "accident_status" DEFAULT 'registered' NOT NULL,
	"location" text,
	"description" text,
	"away_from_work" boolean,
	"worked_hours" numeric,
	"hospital" text,
	"injury_nature_code" text,
	"injury_nature_description" text,
	"body_part_code" text,
	"body_part_description" text,
	"causative_agent_code" text,
	"causative_agent_description" text,
	"causes" text,
	"environmental_impact" text,
	"material_loss" text,
	"third_parties" text,
	"fatality_potential" boolean,
	"responsible_area" text,
	"activity_procedure" text,
	"witnesses" text,
	"investigation_notes" text,
	"cat_number" text,
	"cat_issued_at" date,
	"completion_justification" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accidents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "action_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"origin_type" text NOT NULL,
	"origin_id" uuid NOT NULL,
	"what" text NOT NULL,
	"why" text NOT NULL,
	"who" text NOT NULL,
	"where" text NOT NULL,
	"when" date,
	"how" text NOT NULL,
	"how_much" numeric,
	"priority" smallint,
	"status" "action_plan_status" DEFAULT 'planned' NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_plans_priority_check" CHECK (priority between 1 and 3)
);
--> statement-breakpoint
ALTER TABLE "action_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "risk_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"origin_type" text NOT NULL,
	"origin_id" uuid NOT NULL,
	"status" "risk_audit_status" DEFAULT 'awaiting_analysis' NOT NULL,
	"justification" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "risk_audits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "service_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"service_order_id" uuid NOT NULL,
	"description" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"done" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "service_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"assigned_employee_id" uuid,
	"opened_at" date NOT NULL,
	"due_date" date,
	"closed_at" date,
	"status" "service_order_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accidents" ADD CONSTRAINT "accidents_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accidents" ADD CONSTRAINT "accidents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accidents" ADD CONSTRAINT "accidents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_audits" ADD CONSTRAINT "risk_audits_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_order_items" ADD CONSTRAINT "service_order_items_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_order_items" ADD CONSTRAINT "service_order_items_service_order_id_service_orders_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_assigned_employee_id_employees_id_fk" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accidents_org_id" ON "accidents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_accidents_org_status" ON "accidents" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "idx_accidents_company" ON "accidents" USING btree ("org_id","company_id");--> statement-breakpoint
CREATE INDEX "idx_accidents_occurred" ON "accidents" USING btree ("org_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_action_plans_org_id" ON "action_plans" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_action_plans_origin" ON "action_plans" USING btree ("org_id","origin_type","origin_id");--> statement-breakpoint
CREATE INDEX "idx_action_plans_org_status" ON "action_plans" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "idx_risk_audits_org_id" ON "risk_audits" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_risk_audits_origin" ON "risk_audits" USING btree ("org_id","origin_type","origin_id");--> statement-breakpoint
CREATE INDEX "idx_risk_audits_org_status" ON "risk_audits" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_risk_audits_active_origin" ON "risk_audits" USING btree ("org_id","origin_type","origin_id") WHERE status <> 'completed';--> statement-breakpoint
CREATE INDEX "idx_soi_org_id" ON "service_order_items" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_soi_order" ON "service_order_items" USING btree ("org_id","service_order_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_service_orders_org_id" ON "service_orders" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_service_orders_org_status" ON "service_orders" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "idx_service_orders_assigned" ON "service_orders" USING btree ("org_id","assigned_employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_service_orders_org_id_number" ON "service_orders" USING btree ("org_id","number");--> statement-breakpoint
CREATE POLICY "accidents_isolation" ON "accidents" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "action_plans_isolation" ON "action_plans" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "risk_audits_isolation" ON "risk_audits" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "service_order_items_isolation" ON "service_order_items" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "service_orders_isolation" ON "service_orders" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
-- GRANTs (least-privilege app_runtime) — not auto-emitted by drizzle-kit.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_orders TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_items TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accidents TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plans TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_audits TO app_runtime;--> statement-breakpoint
-- updated_at triggers (reuse public.set_updated_at() from 0001).
DROP TRIGGER IF EXISTS set_updated_at_service_orders ON public.service_orders;--> statement-breakpoint
CREATE TRIGGER set_updated_at_service_orders BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_service_order_items ON public.service_order_items;--> statement-breakpoint
CREATE TRIGGER set_updated_at_service_order_items BEFORE UPDATE ON public.service_order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_accidents ON public.accidents;--> statement-breakpoint
CREATE TRIGGER set_updated_at_accidents BEFORE UPDATE ON public.accidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_action_plans ON public.action_plans;--> statement-breakpoint
CREATE TRIGGER set_updated_at_action_plans BEFORE UPDATE ON public.action_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_risk_audits ON public.risk_audits;--> statement-breakpoint
CREATE TRIGGER set_updated_at_risk_audits BEFORE UPDATE ON public.risk_audits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();