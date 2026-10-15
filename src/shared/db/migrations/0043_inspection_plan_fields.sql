CREATE TYPE "public"."inspection_plan_status" AS ENUM('active', 'draft', 'inactive');--> statement-breakpoint
ALTER TYPE "public"."inspection_frequency" ADD VALUE 'biweekly' BEFORE 'monthly';--> statement-breakpoint
ALTER TABLE "inspection_plans" ADD COLUMN "number" integer;--> statement-breakpoint
UPDATE "inspection_plans" p SET "number" = sub.rn FROM (
  SELECT id, row_number() OVER (PARTITION BY org_id ORDER BY created_at, id) AS rn
  FROM "inspection_plans"
) sub WHERE p.id = sub.id;--> statement-breakpoint
ALTER TABLE "inspection_plans" ALTER COLUMN "number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "inspection_plans" ADD COLUMN "frequency" "inspection_frequency";--> statement-breakpoint
ALTER TABLE "inspection_plans" ADD COLUMN "status" "inspection_plan_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_inspection_plans_org_id_number" ON "inspection_plans" USING btree ("org_id","number");
