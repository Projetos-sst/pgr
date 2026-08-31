ALTER TABLE "job_roles" ADD COLUMN "sector" text;--> statement-breakpoint
ALTER TABLE "job_roles" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;