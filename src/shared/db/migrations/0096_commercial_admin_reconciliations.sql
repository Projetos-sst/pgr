CREATE TABLE "commercial_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contract_id" uuid NOT NULL,
	"operator_id" text NOT NULL,
	"reason" text NOT NULL,
	"result" text NOT NULL,
	"detail" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commercial_reconciliations_reason" CHECK (char_length(btrim("commercial_reconciliations"."reason")) >= 10),
	CONSTRAINT "commercial_reconciliations_result" CHECK ("commercial_reconciliations"."result" in ('no_change','corrected','source_unavailable')),
	CONSTRAINT "commercial_reconciliations_source" CHECK ("commercial_reconciliations"."source" in ('provider','mirror'))
);
--> statement-breakpoint
ALTER TABLE "commercial_reconciliations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "commercial_reconciliations" ADD CONSTRAINT "commercial_reconciliations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_reconciliations" ADD CONSTRAINT "commercial_reconciliations_contract_fk" FOREIGN KEY ("contract_id","org_id") REFERENCES "public"."commercial_contracts"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_commercial_reconciliations_contract" ON "commercial_reconciliations" USING btree ("org_id","contract_id","created_at");--> statement-breakpoint
CREATE POLICY "billing_events_platform_operator" ON "billing_events" AS PERMISSIVE FOR SELECT TO "app_runtime" USING (exists(select 1 from public.users u where u.id = nullif(current_setting('app.platform_operator', true), '') and u.is_master));--> statement-breakpoint
CREATE POLICY "billing_subscriptions_platform_operator" ON "billing_subscriptions" AS PERMISSIVE FOR SELECT TO "app_runtime" USING (exists(select 1 from public.users u where u.id = nullif(current_setting('app.platform_operator', true), '') and u.is_master));--> statement-breakpoint
CREATE POLICY "commercial_entitlements_platform_operator" ON "commercial_entitlements" AS PERMISSIVE FOR SELECT TO "app_runtime" USING (exists(select 1 from public.users u where u.id = nullif(current_setting('app.platform_operator', true), '') and u.is_master));--> statement-breakpoint
CREATE POLICY "commercial_contract_items_platform_operator" ON "commercial_contract_items" AS PERMISSIVE FOR SELECT TO "app_runtime" USING (exists(select 1 from public.users u where u.id = nullif(current_setting('app.platform_operator', true), '') and u.is_master));--> statement-breakpoint
CREATE POLICY "commercial_contracts_platform_operator" ON "commercial_contracts" AS PERMISSIVE FOR SELECT TO "app_runtime" USING (exists(select 1 from public.users u where u.id = nullif(current_setting('app.platform_operator', true), '') and u.is_master));--> statement-breakpoint
CREATE POLICY "users_platform_operator_self" ON "users" AS PERMISSIVE FOR SELECT TO "app_runtime" USING ("users"."id" = nullif(current_setting('app.platform_operator', true), ''));--> statement-breakpoint
CREATE POLICY "commercial_reconciliations_tenant" ON "commercial_reconciliations" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "commercial_reconciliations_provider_event" ON "commercial_reconciliations" AS RESTRICTIVE FOR ALL TO "app_runtime" USING ((nullif(current_setting('app.current_actor',true),'') is null or exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=nullif(current_setting('app.current_actor',true),'') and m.role in ('owner','org:admin')))) WITH CHECK (nullif(current_setting('app.current_actor',true),'') is null);--> statement-breakpoint
CREATE POLICY "commercial_reconciliations_platform_operator" ON "commercial_reconciliations" AS PERMISSIVE FOR SELECT TO "app_runtime" USING (exists(select 1 from public.users u where u.id = nullif(current_setting('app.platform_operator', true), '') and u.is_master));--> statement-breakpoint
ALTER POLICY "commercial_contract_items_administrator" ON "commercial_contract_items" TO app_runtime USING ((exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')) or exists(select 1 from public.users u where u.id = nullif(current_setting('app.platform_operator', true), '') and u.is_master))) WITH CHECK (exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
ALTER POLICY "commercial_contracts_administrator" ON "commercial_contracts" TO app_runtime USING ((exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')) or exists(select 1 from public.users u where u.id = nullif(current_setting('app.platform_operator', true), '') and u.is_master))) WITH CHECK (exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
GRANT SELECT, INSERT ON public.commercial_reconciliations TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.commercial_reconciliations FROM app_runtime;
