CREATE TABLE "billing_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"provider_subscription_id" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_billing_contract_org" UNIQUE("id","org_id"),
	CONSTRAINT "billing_contract_status" CHECK ("billing_contracts"."status" in ('pending_payment','requires_action','trialing','active','past_due','unpaid','canceled','expired')),
	CONSTRAINT "billing_contract_revision" CHECK ("billing_contracts"."revision">=0)
);
--> statement-breakpoint
ALTER TABLE "billing_contracts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"provider_customer_id" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_billing_customer_company" UNIQUE("org_id","company_id"),
	CONSTRAINT "uq_billing_customer_org" UNIQUE("id","org_id")
);
--> statement-breakpoint
ALTER TABLE "billing_customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contract_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"product" text NOT NULL,
	"scope" text NOT NULL,
	"valid_until" timestamp with time zone,
	"active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "uq_billing_entitlement" UNIQUE("org_id","contract_id","product"),
	CONSTRAINT "billing_entitlement_product" CHECK ("billing_entitlements"."product" in ('pro','pgr','medicine'))
);
--> statement-breakpoint
ALTER TABLE "billing_entitlements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contract_id" uuid NOT NULL,
	"provider_event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"applied" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_billing_provider_event" UNIQUE("org_id","provider_event_id")
);
--> statement-breakpoint
ALTER TABLE "billing_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"trial_id" uuid NOT NULL,
	"interest" text NOT NULL,
	"message" text NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_billing_interest_trial" UNIQUE("org_id","trial_id","interest")
);
--> statement-breakpoint
ALTER TABLE "billing_interests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contract_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_billing_invoice_event" UNIQUE("org_id","event_id"),
	CONSTRAINT "billing_invoice_amount" CHECK ("billing_invoices"."amount_minor" between 0 and 99999999),
	CONSTRAINT "billing_invoice_status" CHECK ("billing_invoices"."status" in ('open','paid','void'))
);
--> statement-breakpoint
ALTER TABLE "billing_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_offer_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"code" text NOT NULL,
	"version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_billing_offer_version" UNIQUE("org_id","code","version"),
	CONSTRAINT "uq_billing_offer_org" UNIQUE("id","org_id"),
	CONSTRAINT "billing_offer_positive_version" CHECK ("billing_offer_versions"."version">0)
);
--> statement-breakpoint
ALTER TABLE "billing_offer_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"request_hash" text NOT NULL,
	"result_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_billing_operation_key" UNIQUE("org_id","key")
);
--> statement-breakpoint
ALTER TABLE "billing_operations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_provider_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contract_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "uq_billing_provider_contract" UNIQUE("org_id","contract_id")
);
--> statement-breakpoint
ALTER TABLE "billing_provider_states" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_change_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contract_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"expected_revision" integer NOT NULL,
	"amount_minor" integer NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_change_quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_trials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"converted_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_billing_trial_company" UNIQUE("org_id","company_id"),
	CONSTRAINT "uq_billing_trial_org" UNIQUE("id","org_id"),
	CONSTRAINT "billing_trial_duration" CHECK ("billing_trials"."ends_at"="billing_trials"."started_at"+interval '15 days')
);
--> statement-breakpoint
ALTER TABLE "billing_trials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_audit" ADD CONSTRAINT "billing_audit_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_contracts" ADD CONSTRAINT "billing_contracts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_contracts" ADD CONSTRAINT "billing_contracts_customer_id_org_id_billing_customers_id_org_id_fk" FOREIGN KEY ("customer_id","org_id") REFERENCES "public"."billing_customers"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_contracts" ADD CONSTRAINT "billing_contracts_offer_id_org_id_billing_offer_versions_id_org_id_fk" FOREIGN KEY ("offer_id","org_id") REFERENCES "public"."billing_offer_versions"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_company_id_org_id_companies_id_org_id_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_entitlements" ADD CONSTRAINT "billing_entitlements_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_entitlements" ADD CONSTRAINT "billing_entitlements_contract_id_org_id_billing_contracts_id_org_id_fk" FOREIGN KEY ("contract_id","org_id") REFERENCES "public"."billing_contracts"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_entitlements" ADD CONSTRAINT "billing_entitlements_company_id_org_id_companies_id_org_id_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_contract_id_org_id_billing_contracts_id_org_id_fk" FOREIGN KEY ("contract_id","org_id") REFERENCES "public"."billing_contracts"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_interests" ADD CONSTRAINT "billing_interests_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_interests" ADD CONSTRAINT "billing_interests_trial_id_org_id_billing_trials_id_org_id_fk" FOREIGN KEY ("trial_id","org_id") REFERENCES "public"."billing_trials"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_contract_id_org_id_billing_contracts_id_org_id_fk" FOREIGN KEY ("contract_id","org_id") REFERENCES "public"."billing_contracts"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_offer_versions" ADD CONSTRAINT "billing_offer_versions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_operations" ADD CONSTRAINT "billing_operations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_provider_states" ADD CONSTRAINT "billing_provider_states_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_provider_states" ADD CONSTRAINT "billing_provider_states_contract_id_org_id_billing_contracts_id_org_id_fk" FOREIGN KEY ("contract_id","org_id") REFERENCES "public"."billing_contracts"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_change_quotes" ADD CONSTRAINT "billing_change_quotes_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_change_quotes" ADD CONSTRAINT "billing_change_quotes_contract_id_org_id_billing_contracts_id_org_id_fk" FOREIGN KEY ("contract_id","org_id") REFERENCES "public"."billing_contracts"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_change_quotes" ADD CONSTRAINT "billing_change_quotes_offer_id_org_id_billing_offer_versions_id_org_id_fk" FOREIGN KEY ("offer_id","org_id") REFERENCES "public"."billing_offer_versions"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_trials" ADD CONSTRAINT "billing_trials_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_trials" ADD CONSTRAINT "billing_trials_company_id_org_id_companies_id_org_id_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_billing_contract_customer" ON "billing_contracts" USING btree ("org_id","customer_id");--> statement-breakpoint
-- No legacy rows, billing configuration or company_modules are rewritten.
GRANT SELECT, INSERT ON public.billing_audit, public.billing_events, public.billing_offer_versions, public.billing_operations TO app_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.billing_customers, public.billing_contracts, public.billing_entitlements, public.billing_interests, public.billing_invoices, public.billing_provider_states, public.billing_change_quotes, public.billing_trials TO app_runtime;
--> statement-breakpoint
CREATE POLICY "billing_audit_owner" ON "billing_audit" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) WITH CHECK (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
CREATE POLICY "billing_contracts_owner" ON "billing_contracts" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) WITH CHECK (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
CREATE POLICY "billing_customers_owner" ON "billing_customers" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) WITH CHECK (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
CREATE POLICY "billing_entitlements_owner" ON "billing_entitlements" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) WITH CHECK (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
CREATE POLICY "billing_events_owner" ON "billing_events" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) WITH CHECK (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
CREATE POLICY "billing_interests_owner" ON "billing_interests" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) WITH CHECK (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
CREATE POLICY "billing_invoices_owner" ON "billing_invoices" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) WITH CHECK (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
CREATE POLICY "billing_offer_versions_owner" ON "billing_offer_versions" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) WITH CHECK (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
CREATE POLICY "billing_operations_owner" ON "billing_operations" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) WITH CHECK (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
CREATE POLICY "billing_provider_states_owner" ON "billing_provider_states" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) WITH CHECK (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
CREATE POLICY "billing_change_quotes_owner" ON "billing_change_quotes" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) WITH CHECK (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
CREATE POLICY "billing_trials_owner" ON "billing_trials" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) WITH CHECK (org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));
