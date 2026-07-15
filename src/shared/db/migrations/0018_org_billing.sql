ALTER TABLE "orgs" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "trial_ends_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "orgs_stripe_customer_id_unique" ON "orgs" USING btree ("stripe_customer_id");