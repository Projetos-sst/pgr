CREATE TYPE "public"."schedule_event_type" AS ENUM('inspection', 'training', 'exam', 'document_expiry', 'other');--> statement-breakpoint
CREATE TABLE "schedule_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"event_type" "schedule_event_type" NOT NULL,
	"title" text NOT NULL,
	"event_date" date NOT NULL,
	"description" text,
	"reference_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schedule_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_schedule_events_org_id" ON "schedule_events" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_schedule_events_org_date" ON "schedule_events" USING btree ("org_id","event_date");--> statement-breakpoint
CREATE POLICY "schedule_events_isolation" ON "schedule_events" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_events TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_schedule_events ON public.schedule_events;--> statement-breakpoint
CREATE TRIGGER set_updated_at_schedule_events BEFORE UPDATE ON public.schedule_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
