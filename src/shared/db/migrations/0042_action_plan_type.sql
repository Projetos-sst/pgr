CREATE TYPE "public"."action_plan_type" AS ENUM('corrective', 'preventive');--> statement-breakpoint
ALTER TABLE "action_plans" ADD COLUMN "type" "action_plan_type";