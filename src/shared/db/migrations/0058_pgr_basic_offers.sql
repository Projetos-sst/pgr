CREATE TABLE "pgr_basic_offer_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"version_id" uuid NOT NULL,
	"event" text NOT NULL,
	"actor" text NOT NULL,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pgr_basic_offer_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pgr_basic_offer_publication" (
	"org_id" text PRIMARY KEY NOT NULL,
	"active_version_id" uuid,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pgr_basic_offer_publication" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pgr_basic_offer_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_pgr_basic_offer_version" UNIQUE("org_id","version")
);
--> statement-breakpoint
ALTER TABLE "pgr_basic_offer_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pgr_basic_offer_events" ADD CONSTRAINT "pgr_basic_offer_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_basic_offer_events" ADD CONSTRAINT "pgr_basic_offer_events_version_id_pgr_basic_offer_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."pgr_basic_offer_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_basic_offer_publication" ADD CONSTRAINT "pgr_basic_offer_publication_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_basic_offer_publication" ADD CONSTRAINT "pgr_basic_offer_publication_active_version_id_pgr_basic_offer_versions_id_fk" FOREIGN KEY ("active_version_id") REFERENCES "public"."pgr_basic_offer_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgr_basic_offer_versions" ADD CONSTRAINT "pgr_basic_offer_versions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_basic_offer_events" ON "pgr_basic_offer_events" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE POLICY "basic_offer_events_tenant" ON "pgr_basic_offer_events" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "basic_offer_events_owner" ON "pgr_basic_offer_events" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK (exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')) and "pgr_basic_offer_events"."actor"=current_setting('app.current_actor',true) and exists(select 1 from public.pgr_basic_offer_versions v where v.id="pgr_basic_offer_events"."version_id" and v.org_id="pgr_basic_offer_events"."org_id"));--> statement-breakpoint
CREATE POLICY "basic_offer_publication_tenant" ON "pgr_basic_offer_publication" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "basic_offer_publication_owner_insert" ON "pgr_basic_offer_publication" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK (exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')) and "pgr_basic_offer_publication"."changed_by"=current_setting('app.current_actor',true) and ("pgr_basic_offer_publication"."active_version_id" is null or exists(select 1 from public.pgr_basic_offer_versions v where v.id="pgr_basic_offer_publication"."active_version_id" and v.org_id="pgr_basic_offer_publication"."org_id")));--> statement-breakpoint
CREATE POLICY "basic_offer_publication_owner_update" ON "pgr_basic_offer_publication" AS RESTRICTIVE FOR UPDATE TO "app_runtime" USING (exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) WITH CHECK (exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')) and "pgr_basic_offer_publication"."changed_by"=current_setting('app.current_actor',true) and ("pgr_basic_offer_publication"."active_version_id" is null or exists(select 1 from public.pgr_basic_offer_versions v where v.id="pgr_basic_offer_publication"."active_version_id" and v.org_id="pgr_basic_offer_publication"."org_id")));--> statement-breakpoint
CREATE POLICY "basic_offer_versions_tenant" ON "pgr_basic_offer_versions" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "basic_offer_versions_owner" ON "pgr_basic_offer_versions" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK (exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')) and "pgr_basic_offer_versions"."created_by"=current_setting('app.current_actor',true));
--> statement-breakpoint
GRANT SELECT, INSERT ON public.pgr_basic_offer_versions, public.pgr_basic_offer_events TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.pgr_basic_offer_versions, public.pgr_basic_offer_events FROM app_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.pgr_basic_offer_publication TO app_runtime;
--> statement-breakpoint
REVOKE DELETE ON public.pgr_basic_offer_publication FROM app_runtime;
