CREATE TABLE "company_risk_authorizers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text,
	"evidence" text NOT NULL,
	"reason" text NOT NULL,
	"recorded_by" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_company_risk_authorizer" UNIQUE("org_id","company_id")
);
--> statement-breakpoint
ALTER TABLE "company_risk_authorizers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "medical_risk_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"reviewer_id" text NOT NULL,
	"identity" jsonb NOT NULL,
	"previous_status" text NOT NULL,
	"status" text NOT NULL,
	"reason" text NOT NULL,
	"source_fingerprint" text NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "medical_risk_decision_status" CHECK ("medical_risk_decisions"."status" in ('validated','rejected'))
);
--> statement-breakpoint
ALTER TABLE "medical_risk_decisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "professional_risk_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"active" boolean NOT NULL,
	"identity" jsonb NOT NULL,
	"authorized_by" text NOT NULL,
	"authorized_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text NOT NULL,
	CONSTRAINT "uq_professional_risk_authorization" UNIQUE("org_id","company_id","user_id"),
	CONSTRAINT "professional_risk_identity_object" CHECK (jsonb_typeof("professional_risk_authorizations"."identity") = 'object')
);
--> statement-breakpoint
ALTER TABLE "professional_risk_authorizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "risk_authorization_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"subject_user_id" text,
	"event" text NOT NULL,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "risk_authorization_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_risk_authorizers" ADD CONSTRAINT "company_risk_authorizers_company_id_org_id_companies_id_org_id_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_risk_authorizers" ADD CONSTRAINT "company_risk_authorizers_org_id_user_id_org_memberships_org_id_user_id_fk" FOREIGN KEY ("org_id","user_id") REFERENCES "public"."org_memberships"("org_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_risk_entries" ADD CONSTRAINT "uq_medical_risk_entry_identity" UNIQUE("id","org_id","company_id");--> statement-breakpoint
ALTER TABLE "medical_risk_decisions" ADD CONSTRAINT "medical_risk_decisions_entry_id_org_id_company_id_medical_risk_entries_id_org_id_company_id_fk" FOREIGN KEY ("entry_id","org_id","company_id") REFERENCES "public"."medical_risk_entries"("id","org_id","company_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_risk_authorizations" ADD CONSTRAINT "professional_risk_authorizations_company_id_org_id_companies_id_org_id_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_risk_authorizations" ADD CONSTRAINT "professional_risk_authorizations_org_id_user_id_org_memberships_org_id_user_id_fk" FOREIGN KEY ("org_id","user_id") REFERENCES "public"."org_memberships"("org_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_authorization_events" ADD CONSTRAINT "risk_authorization_events_company_id_org_id_companies_id_org_id_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_medical_risk_decisions_company" ON "medical_risk_decisions" USING btree ("org_id","company_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "idx_risk_authorization_events_company" ON "risk_authorization_events" USING btree ("org_id","company_id","created_at");--> statement-breakpoint
CREATE POLICY "medical_risk_entries_authorized_review" ON "medical_risk_entries" AS RESTRICTIVE FOR UPDATE TO "app_runtime" USING (exists (select 1 from public.professional_risk_authorizations a where a.org_id = "medical_risk_entries"."org_id" and a.company_id = "medical_risk_entries"."company_id" and a.user_id = current_setting('app.current_actor', true) and a.active = true)) WITH CHECK ("medical_risk_entries"."reviewed_by" = current_setting('app.current_actor', true) and exists (select 1 from public.professional_risk_authorizations a where a.org_id = "medical_risk_entries"."org_id" and a.company_id = "medical_risk_entries"."company_id" and a.user_id = current_setting('app.current_actor', true) and a.active = true));--> statement-breakpoint
CREATE POLICY "org_memberships_risk_actor_read" ON "org_memberships" AS PERMISSIVE FOR SELECT TO "app_runtime" USING ("org_memberships"."org_id" = current_setting('app.current_org', true) and nullif(current_setting('app.current_actor', true), '') is not null);--> statement-breakpoint
CREATE POLICY "risk_authorizers_tenant" ON "company_risk_authorizers" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "risk_authorizers_owner_insert" ON "company_risk_authorizers" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK (exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = current_setting('app.current_actor', true) and m.role in ('owner','org:admin')) and "company_risk_authorizers"."recorded_by" = current_setting('app.current_actor', true));--> statement-breakpoint
CREATE POLICY "risk_authorizers_owner_update" ON "company_risk_authorizers" AS RESTRICTIVE FOR UPDATE TO "app_runtime" USING (exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = current_setting('app.current_actor', true) and m.role in ('owner','org:admin'))) WITH CHECK (exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = current_setting('app.current_actor', true) and m.role in ('owner','org:admin')) and "company_risk_authorizers"."recorded_by" = current_setting('app.current_actor', true));--> statement-breakpoint
CREATE POLICY "medical_risk_decisions_tenant" ON "medical_risk_decisions" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "medical_risk_decisions_professional" ON "medical_risk_decisions" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("medical_risk_decisions"."reviewer_id" = current_setting('app.current_actor', true) and exists (select 1 from public.professional_risk_authorizations a where a.org_id = "medical_risk_decisions"."org_id" and a.company_id = "medical_risk_decisions"."company_id" and a.user_id = current_setting('app.current_actor', true) and a.active = true));--> statement-breakpoint
CREATE POLICY "professional_risk_authorizations_tenant" ON "professional_risk_authorizations" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "professional_risk_authorizations_grant" ON "professional_risk_authorizations" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK (exists (select 1 from public.company_risk_authorizers a where a.org_id = "professional_risk_authorizations"."org_id" and a.company_id = "professional_risk_authorizations"."company_id" and a.user_id = current_setting('app.current_actor', true)) and "professional_risk_authorizations"."authorized_by" = current_setting('app.current_actor', true));--> statement-breakpoint
CREATE POLICY "professional_risk_authorizations_change" ON "professional_risk_authorizations" AS RESTRICTIVE FOR UPDATE TO "app_runtime" USING (exists (select 1 from public.company_risk_authorizers a where a.org_id = "professional_risk_authorizations"."org_id" and a.company_id = "professional_risk_authorizations"."company_id" and a.user_id = current_setting('app.current_actor', true))) WITH CHECK (exists (select 1 from public.company_risk_authorizers a where a.org_id = "professional_risk_authorizations"."org_id" and a.company_id = "professional_risk_authorizations"."company_id" and a.user_id = current_setting('app.current_actor', true)) and "professional_risk_authorizations"."authorized_by" = current_setting('app.current_actor', true));--> statement-breakpoint
CREATE POLICY "risk_authorization_events_tenant" ON "risk_authorization_events" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "risk_authorization_events_actor" ON "risk_authorization_events" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("risk_authorization_events"."actor" = current_setting('app.current_actor', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.company_risk_authorizers, public.professional_risk_authorizations TO app_runtime;
--> statement-breakpoint
REVOKE DELETE ON public.company_risk_authorizers, public.professional_risk_authorizations FROM app_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.risk_authorization_events, public.medical_risk_decisions TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.risk_authorization_events, public.medical_risk_decisions FROM app_runtime;
--> statement-breakpoint
GRANT UPDATE (status, reviewed_by, reviewed_at, review_note) ON public.medical_risk_entries TO app_runtime;
