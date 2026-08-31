CREATE TYPE "public"."company_status" AS ENUM('active', 'pending', 'inactive');--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "status" "company_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "tax_classification" text;