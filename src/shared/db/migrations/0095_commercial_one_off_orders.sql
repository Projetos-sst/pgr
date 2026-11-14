CREATE TABLE "commercial_one_off_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contract_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_payment_ref" text,
	"paid_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_commercial_one_off_orders_contract" UNIQUE("org_id","contract_id"),
	CONSTRAINT "commercial_one_off_orders_status" CHECK ("commercial_one_off_orders"."status" in ('pending','paid','cancelled')),
	CONSTRAINT "commercial_one_off_orders_paid" CHECK (("commercial_one_off_orders"."status" = 'paid') = ("commercial_one_off_orders"."paid_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "commercial_one_off_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "commercial_one_off_orders" ADD CONSTRAINT "commercial_one_off_orders_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_one_off_orders" ADD CONSTRAINT "commercial_one_off_orders_contract_fk" FOREIGN KEY ("contract_id","org_id") REFERENCES "public"."commercial_contracts"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_one_off_orders" ADD CONSTRAINT "commercial_one_off_orders_company_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_commercial_one_off_orders_company" ON "commercial_one_off_orders" USING btree ("org_id","company_id","status");--> statement-breakpoint
CREATE POLICY "commercial_one_off_orders_tenant" ON "commercial_one_off_orders" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "commercial_one_off_orders_actor_scope" ON "commercial_one_off_orders" AS RESTRICTIVE FOR SELECT TO "app_runtime" USING ((nullif(current_setting('app.current_actor', true), '') is null or exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = nullif(current_setting('app.current_actor', true), '') and m.role in ('owner','org:admin')) or not exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '')) or exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '') and s.company_id = "commercial_one_off_orders"."company_id")));--> statement-breakpoint
CREATE POLICY "commercial_one_off_orders_actor" ON "commercial_one_off_orders" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("commercial_one_off_orders"."created_by"=current_setting('app.current_actor',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')) and (nullif(current_setting('app.current_actor', true), '') is null or exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = nullif(current_setting('app.current_actor', true), '') and m.role in ('owner','org:admin')) or not exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '')) or exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '') and s.company_id = "commercial_one_off_orders"."company_id")));--> statement-breakpoint
CREATE POLICY "commercial_one_off_orders_provider_event" ON "commercial_one_off_orders" AS RESTRICTIVE FOR UPDATE TO "app_runtime" USING (nullif(current_setting('app.current_actor',true),'') is null) WITH CHECK (nullif(current_setting('app.current_actor',true),'') is null);--> statement-breakpoint
GRANT SELECT, INSERT ON public.commercial_one_off_orders TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.commercial_one_off_orders FROM app_runtime;
--> statement-breakpoint
GRANT UPDATE (status, paid_at, provider_payment_ref) ON public.commercial_one_off_orders TO app_runtime;
