CREATE TABLE "medical_risk_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	CONSTRAINT "medical_risk_entries_status_check" CHECK ("medical_risk_entries"."status" in ('pending','validated','rejected')),
	CONSTRAINT "medical_risk_entries_reviewer_check" CHECK (("medical_risk_entries"."status" = 'pending' and "medical_risk_entries"."reviewed_by" is null and "medical_risk_entries"."reviewed_at" is null) or ("medical_risk_entries"."status" in ('validated','rejected') and "medical_risk_entries"."reviewed_by" is not null and "medical_risk_entries"."reviewed_at" is not null)),
	CONSTRAINT "medical_risk_entries_content_check" CHECK (jsonb_typeof("medical_risk_entries"."content") = 'object')
);
--> statement-breakpoint
ALTER TABLE "medical_risk_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "medical_risk_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"event" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "medical_risk_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "medical_risk_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"version" text NOT NULL,
	"reference" text NOT NULL,
	"origin_pgr_id" uuid,
	"origin_revision" integer,
	"fingerprint" text NOT NULL,
	"supersedes_source_id" uuid,
	"registered_by" text NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_medical_sources_identity" UNIQUE("id","org_id","company_id"),
	CONSTRAINT "uq_medical_sources_fingerprint" UNIQUE("org_id","company_id","fingerprint"),
	CONSTRAINT "uq_medical_sources_successor" UNIQUE("org_id","company_id","supersedes_source_id"),
	CONSTRAINT "medical_sources_no_self_successor" CHECK ("medical_risk_sources"."supersedes_source_id" is null or "medical_risk_sources"."supersedes_source_id" <> "medical_risk_sources"."id"),
	CONSTRAINT "medical_sources_kind_check" CHECK ("medical_risk_sources"."kind" in ('internal','external')),
	CONSTRAINT "medical_sources_origin_check" CHECK (("medical_risk_sources"."kind" = 'internal' and "medical_risk_sources"."origin_pgr_id" is not null) or ("medical_risk_sources"."kind" = 'external' and "medical_risk_sources"."origin_pgr_id" is null))
);
--> statement-breakpoint
ALTER TABLE "medical_risk_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "medical_risk_entries" ADD CONSTRAINT "medical_risk_entries_source_id_org_id_company_id_medical_risk_sources_id_org_id_company_id_fk" FOREIGN KEY ("source_id","org_id","company_id") REFERENCES "public"."medical_risk_sources"("id","org_id","company_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_risk_events" ADD CONSTRAINT "medical_risk_events_source_id_org_id_company_id_medical_risk_sources_id_org_id_company_id_fk" FOREIGN KEY ("source_id","org_id","company_id") REFERENCES "public"."medical_risk_sources"("id","org_id","company_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_risk_sources" ADD CONSTRAINT "medical_risk_sources_company_id_org_id_companies_id_org_id_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_risk_sources" ADD CONSTRAINT "medical_risk_sources_supersedes_source_id_org_id_company_id_medical_risk_sources_id_org_id_company_id_fk" FOREIGN KEY ("supersedes_source_id","org_id","company_id") REFERENCES "public"."medical_risk_sources"("id","org_id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_medical_risk_entries_source" ON "medical_risk_entries" USING btree ("org_id","source_id");--> statement-breakpoint
CREATE INDEX "idx_medical_risk_events_source" ON "medical_risk_events" USING btree ("org_id","source_id");--> statement-breakpoint
CREATE INDEX "idx_medical_sources_company" ON "medical_risk_sources" USING btree ("org_id","company_id","registered_at");--> statement-breakpoint
CREATE POLICY "medical_risk_entries_isolation" ON "medical_risk_entries" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "medical_risk_entries_pending_insert" ON "medical_risk_entries" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("medical_risk_entries"."status" = 'pending' and "medical_risk_entries"."reviewed_by" is null and "medical_risk_entries"."reviewed_at" is null);--> statement-breakpoint
CREATE POLICY "medical_risk_entries_module_access" ON "medical_risk_entries" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "medical_risk_entries"."org_id" and cm.company_id = "medical_risk_entries"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "medical_risk_entries"."org_id" and cm.company_id = "medical_risk_entries"."company_id" and cm.module = 'medicine' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "medical_risk_events_isolation" ON "medical_risk_events" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "medical_risk_events_module_access" ON "medical_risk_events" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "medical_risk_events"."org_id" and cm.company_id = "medical_risk_events"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "medical_risk_events"."org_id" and cm.company_id = "medical_risk_events"."company_id" and cm.module = 'medicine' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "medical_sources_isolation" ON "medical_risk_sources" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "medical_sources_module_access" ON "medical_risk_sources" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "medical_risk_sources"."org_id" and cm.company_id = "medical_risk_sources"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "medical_risk_sources"."org_id" and cm.company_id = "medical_risk_sources"."company_id" and cm.module = 'medicine' and cm.enabled = true));
--> statement-breakpoint
GRANT SELECT, INSERT ON public.medical_risk_sources, public.medical_risk_entries, public.medical_risk_events TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.medical_risk_sources, public.medical_risk_entries, public.medical_risk_events FROM app_runtime;
