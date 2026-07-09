CREATE TABLE "ai_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_usage_events_org_id" ON "ai_usage_events" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_events_org_kind_created" ON "ai_usage_events" USING btree ("org_id","kind","created_at");--> statement-breakpoint
CREATE POLICY "ai_usage_events_isolation" ON "ai_usage_events" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT ON public.ai_usage_events TO app_runtime;