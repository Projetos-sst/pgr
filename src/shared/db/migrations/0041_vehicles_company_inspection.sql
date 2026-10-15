CREATE TYPE "public"."inspection_frequency" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual');--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "renavam" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "year" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "work_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "inspection_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "inspection_frequency" "inspection_frequency";--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_work_unit_id_work_units_id_fk" FOREIGN KEY ("work_unit_id") REFERENCES "public"."work_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_inspection_plan_id_inspection_plans_id_fk" FOREIGN KEY ("inspection_plan_id") REFERENCES "public"."inspection_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_vehicles_company_id" ON "vehicles" USING btree ("org_id","company_id");--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_year_check" CHECK ("vehicles"."year" is null or ("vehicles"."year" between 1900 and 2100));