CREATE TYPE "public"."inspection_category" AS ENUM('safety', 'environment', 'quality', 'health', 'other');--> statement-breakpoint
CREATE TYPE "public"."inspection_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."inspection_type" AS ENUM('vehicular', 'equipment', 'safety');--> statement-breakpoint
CREATE TYPE "public"."occurrence_severity" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('car', 'motorcycle', 'truck', 'bus', 'van', 'utility', 'pickup', 'other');--> statement-breakpoint
CREATE TABLE "inspection_item_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"inspection_id" uuid NOT NULL,
	"plan_item_id" uuid NOT NULL,
	"value" boolean,
	"observation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inspection_item_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "inspection_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"inspection_id" uuid NOT NULL,
	"description" text NOT NULL,
	"severity" "occurrence_severity",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inspection_occurrences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "inspection_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"plan_id" uuid NOT NULL,
	"description" text NOT NULL,
	"default_value" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inspection_plan_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "inspection_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"type" "inspection_type" NOT NULL,
	"subtype" text,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inspection_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"type" "inspection_type" NOT NULL,
	"status" "inspection_status" DEFAULT 'pending' NOT NULL,
	"inspected_at" date NOT NULL,
	"plan_id" uuid,
	"vehicle_id" uuid,
	"equipment_catalog_id" uuid,
	"company_id" uuid,
	"responsible" text,
	"driver_name" text,
	"driver_license" text,
	"current_km" integer,
	"route" text,
	"category" "inspection_category",
	"planned" boolean,
	"area" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inspections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"plate" text NOT NULL,
	"brand" text,
	"model" text,
	"type" "vehicle_type",
	"color" text,
	"owner" text,
	"initial_km" integer DEFAULT 0 NOT NULL,
	"photo_path" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_initial_km_check" CHECK ("vehicles"."initial_km" >= 0)
);
--> statement-breakpoint
ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inspection_item_responses" ADD CONSTRAINT "inspection_item_responses_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_item_responses" ADD CONSTRAINT "inspection_item_responses_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_item_responses" ADD CONSTRAINT "inspection_item_responses_plan_item_id_inspection_plan_items_id_fk" FOREIGN KEY ("plan_item_id") REFERENCES "public"."inspection_plan_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_occurrences" ADD CONSTRAINT "inspection_occurrences_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_occurrences" ADD CONSTRAINT "inspection_occurrences_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_plan_items" ADD CONSTRAINT "inspection_plan_items_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_plan_items" ADD CONSTRAINT "inspection_plan_items_plan_id_inspection_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."inspection_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_plans" ADD CONSTRAINT "inspection_plans_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_plan_id_inspection_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."inspection_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_equipment_catalog_id_epi_catalog_id_fk" FOREIGN KEY ("equipment_catalog_id") REFERENCES "public"."epi_catalog"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_inspection_item_responses_org_id" ON "inspection_item_responses" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_inspection_item_responses_inspection_item" ON "inspection_item_responses" USING btree ("inspection_id","plan_item_id");--> statement-breakpoint
CREATE INDEX "idx_inspection_occurrences_org_id" ON "inspection_occurrences" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_inspection_occurrences_inspection_id" ON "inspection_occurrences" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX "idx_inspection_plan_items_org_id" ON "inspection_plan_items" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_inspection_plan_items_plan_id" ON "inspection_plan_items" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_inspection_plans_org_id" ON "inspection_plans" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_inspections_org_id" ON "inspections" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_inspections_org_type" ON "inspections" USING btree ("org_id","type");--> statement-breakpoint
CREATE INDEX "idx_inspections_vehicle_id" ON "inspections" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_vehicles_org_id" ON "vehicles" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_vehicles_org_id_plate" ON "vehicles" USING btree ("org_id","plate");--> statement-breakpoint
CREATE POLICY "inspection_item_responses_isolation" ON "inspection_item_responses" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "inspection_occurrences_isolation" ON "inspection_occurrences" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "inspection_plan_items_isolation" ON "inspection_plan_items" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "inspection_plans_isolation" ON "inspection_plans" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "inspections_isolation" ON "inspections" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "vehicles_isolation" ON "vehicles" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_plans TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_inspection_plans ON public.inspection_plans;--> statement-breakpoint
CREATE TRIGGER set_updated_at_inspection_plans BEFORE UPDATE ON public.inspection_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_plan_items TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_inspection_plan_items ON public.inspection_plan_items;--> statement-breakpoint
CREATE TRIGGER set_updated_at_inspection_plan_items BEFORE UPDATE ON public.inspection_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_vehicles ON public.vehicles;--> statement-breakpoint
CREATE TRIGGER set_updated_at_vehicles BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspections TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_inspections ON public.inspections;--> statement-breakpoint
CREATE TRIGGER set_updated_at_inspections BEFORE UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_item_responses TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_inspection_item_responses ON public.inspection_item_responses;--> statement-breakpoint
CREATE TRIGGER set_updated_at_inspection_item_responses BEFORE UPDATE ON public.inspection_item_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_occurrences TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_inspection_occurrences ON public.inspection_occurrences;--> statement-breakpoint
CREATE TRIGGER set_updated_at_inspection_occurrences BEFORE UPDATE ON public.inspection_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
