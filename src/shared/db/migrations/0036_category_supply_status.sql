ALTER TYPE "public"."category_type" ADD VALUE 'supply';--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;