CREATE TYPE "public"."esocial_batch_status" AS ENUM('sent', 'processed', 'error');--> statement-breakpoint
CREATE TYPE "public"."esocial_event_status" AS ENUM('draft', 'pending', 'sent', 'accepted', 'rejected', 'error');--> statement-breakpoint
CREATE TYPE "public"."esocial_event_type" AS ENUM('S-2190', 'S-2200', 'S-2210', 'S-2220', 'S-2221', 'S-2240', 'S-2300');--> statement-breakpoint
CREATE TABLE "esocial_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"protocol_number" text,
	"status" "esocial_batch_status" DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp with time zone,
	"response_received_at" timestamp with time zone,
	"raw_response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "esocial_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "esocial_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"event_type" "esocial_event_type" NOT NULL,
	"reference_id" uuid,
	"payload" text NOT NULL,
	"status" "esocial_event_status" DEFAULT 'draft' NOT NULL,
	"batch_id" uuid,
	"government_response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "esocial_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "esocial_batches" ADD CONSTRAINT "esocial_batches_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esocial_events" ADD CONSTRAINT "esocial_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esocial_events" ADD CONSTRAINT "esocial_events_batch_id_esocial_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."esocial_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_esocial_batches_org_id" ON "esocial_batches" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_esocial_events_org_id" ON "esocial_events" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_esocial_events_org_status" ON "esocial_events" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "idx_esocial_events_org_type" ON "esocial_events" USING btree ("org_id","event_type");--> statement-breakpoint
CREATE INDEX "idx_esocial_events_batch" ON "esocial_events" USING btree ("batch_id");--> statement-breakpoint
CREATE POLICY "esocial_batches_isolation" ON "esocial_batches" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "esocial_events_isolation" ON "esocial_events" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esocial_batches TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esocial_events TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_esocial_batches ON public.esocial_batches;--> statement-breakpoint
CREATE TRIGGER set_updated_at_esocial_batches BEFORE UPDATE ON public.esocial_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_esocial_events ON public.esocial_events;--> statement-breakpoint
CREATE TRIGGER set_updated_at_esocial_events BEFORE UPDATE ON public.esocial_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
