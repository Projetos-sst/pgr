CREATE TYPE "public"."form_control_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."form_control_type" AS ENUM('ficha', 'checklist', 'documento');--> statement-breakpoint
ALTER TABLE "form_controls" ADD COLUMN "type" "form_control_type" DEFAULT 'documento' NOT NULL;--> statement-breakpoint
ALTER TABLE "form_controls" ADD COLUMN "status" "form_control_status" DEFAULT 'published' NOT NULL;