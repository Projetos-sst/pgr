CREATE TYPE "public"."work_unit_status" AS ENUM('active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "public"."work_unit_type" AS ENUM('site', 'branch', 'workfront');--> statement-breakpoint
ALTER TABLE "work_units" ADD COLUMN "type" "work_unit_type";--> statement-breakpoint
ALTER TABLE "work_units" ADD COLUMN "status" "work_unit_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_units" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "work_units" ADD COLUMN "expected_end_date" date;