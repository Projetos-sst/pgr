CREATE TABLE "commercial_trials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"days" integer NOT NULL,
	"started_by" text NOT NULL,
	"converted_at" timestamp with time zone,
	CONSTRAINT "uq_commercial_trials_company" UNIQUE("org_id","company_id"),
	CONSTRAINT "commercial_trials_window" CHECK ("commercial_trials"."ends_at" > "commercial_trials"."started_at"),
	CONSTRAINT "commercial_trials_days" CHECK ("commercial_trials"."days" > 0)
);
--> statement-breakpoint
ALTER TABLE "commercial_trials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "commercial_trials" ADD CONSTRAINT "commercial_trials_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_trials" ADD CONSTRAINT "commercial_trials_company_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_commercial_trials_org_started" ON "commercial_trials" USING btree ("org_id","started_at");--> statement-breakpoint
CREATE POLICY "commercial_trials_tenant" ON "commercial_trials" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "commercial_trials_actor_scope" ON "commercial_trials" AS RESTRICTIVE FOR SELECT TO "app_runtime" USING ((nullif(current_setting('app.current_actor', true), '') is null or exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = nullif(current_setting('app.current_actor', true), '') and m.role in ('owner','org:admin')) or not exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '')) or exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '') and s.company_id = "commercial_trials"."company_id")));--> statement-breakpoint
CREATE POLICY "commercial_trials_actor" ON "commercial_trials" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("commercial_trials"."started_by"=current_setting('app.current_actor',true) and (nullif(current_setting('app.current_actor', true), '') is null or exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = nullif(current_setting('app.current_actor', true), '') and m.role in ('owner','org:admin')) or not exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '')) or exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '') and s.company_id = "commercial_trials"."company_id")));--> statement-breakpoint
GRANT SELECT, INSERT ON public.commercial_trials TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.commercial_trials FROM app_runtime;
