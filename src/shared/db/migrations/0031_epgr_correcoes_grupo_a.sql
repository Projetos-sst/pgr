CREATE TYPE "public"."control_measure_status" AS ENUM('maintain', 'introduced', 'improved');--> statement-breakpoint
ALTER TABLE "epi_catalog" ADD COLUMN "material" text;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "invoice_date" date;--> statement-breakpoint
ALTER TABLE "control_measures" ADD COLUMN "status" "control_measure_status";--> statement-breakpoint
ALTER TABLE "pgr_revisions" ADD COLUMN "archived_at" timestamp with time zone;