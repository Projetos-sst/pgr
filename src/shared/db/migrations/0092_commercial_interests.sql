CREATE TABLE "commercial_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"service" text NOT NULL,
	"message" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen_at" timestamp with time zone,
	"seen_by" text,
	CONSTRAINT "uq_commercial_interests_id_org" UNIQUE("id","org_id"),
	CONSTRAINT "commercial_interests_service" CHECK ("commercial_interests"."service" in ('pgr','medicine','pro','one_off')),
	CONSTRAINT "commercial_interests_message" CHECK ("commercial_interests"."message" is null or (btrim("commercial_interests"."message") <> '' and char_length("commercial_interests"."message") <= 500)),
	CONSTRAINT "commercial_interests_seen" CHECK (("commercial_interests"."seen_at" is null) = ("commercial_interests"."seen_by" is null))
);
--> statement-breakpoint
ALTER TABLE "commercial_interests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "commercial_interests" ADD CONSTRAINT "commercial_interests_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_interests" ADD CONSTRAINT "commercial_interests_company_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_commercial_interests_open" ON "commercial_interests" USING btree ("org_id","company_id","service") WHERE "commercial_interests"."seen_at" is null;--> statement-breakpoint
CREATE INDEX "idx_commercial_interests_org_created" ON "commercial_interests" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE POLICY "commercial_interests_tenant" ON "commercial_interests" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "commercial_interests_actor_scope" ON "commercial_interests" AS RESTRICTIVE FOR SELECT TO "app_runtime" USING ((nullif(current_setting('app.current_actor', true), '') is null or exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = nullif(current_setting('app.current_actor', true), '') and m.role in ('owner','org:admin')) or not exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '')) or exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '') and s.company_id = "commercial_interests"."company_id")));--> statement-breakpoint
CREATE POLICY "commercial_interests_actor" ON "commercial_interests" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("commercial_interests"."created_by"=current_setting('app.current_actor',true) and (nullif(current_setting('app.current_actor', true), '') is null or exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = nullif(current_setting('app.current_actor', true), '') and m.role in ('owner','org:admin')) or not exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '')) or exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '') and s.company_id = "commercial_interests"."company_id")));--> statement-breakpoint
GRANT SELECT, INSERT ON public.commercial_interests TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.commercial_interests FROM app_runtime;
--> statement-breakpoint
GRANT UPDATE (seen_at, seen_by) ON public.commercial_interests TO app_runtime;
