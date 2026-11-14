CREATE TABLE "billing_checkout_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"contract_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"targets" jsonb NOT NULL,
	"provider" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider_session_id" text NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "uq_billing_checkout_sessions_key" UNIQUE("org_id","idempotency_key"),
	CONSTRAINT "uq_billing_checkout_sessions_provider" UNIQUE("provider","provider_session_id"),
	CONSTRAINT "billing_checkout_sessions_provider" CHECK ("billing_checkout_sessions"."provider" = 'stripe'),
	CONSTRAINT "billing_checkout_sessions_targets" CHECK (jsonb_typeof("billing_checkout_sessions"."targets") = 'array'),
	CONSTRAINT "billing_checkout_sessions_status" CHECK ("billing_checkout_sessions"."status" in ('open','completed','expired'))
);
--> statement-breakpoint
ALTER TABLE "billing_checkout_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contract_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"outcome" text NOT NULL,
	"detail" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_billing_events_provider_event" UNIQUE("provider","provider_event_id"),
	CONSTRAINT "billing_events_provider" CHECK ("billing_events"."provider" = 'stripe'),
	CONSTRAINT "billing_events_outcome" CHECK ("billing_events"."outcome" in ('applied','stale','ignored'))
);
--> statement-breakpoint
ALTER TABLE "billing_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"invoice_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"service" text NOT NULL,
	"label" text NOT NULL,
	"quantity" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"provider_price_id" text,
	CONSTRAINT "uq_billing_invoice_items_position" UNIQUE("invoice_id","position"),
	CONSTRAINT "billing_invoice_items_position" CHECK ("billing_invoice_items"."position" > 0),
	CONSTRAINT "billing_invoice_items_service" CHECK ("billing_invoice_items"."service" in ('pgr','medicine','pro','one_off','unclassified'))
);
--> statement-breakpoint
ALTER TABLE "billing_invoice_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contract_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_invoice_id" text NOT NULL,
	"status" text NOT NULL,
	"currency" text NOT NULL,
	"total_cents" integer NOT NULL,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"last_event_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_billing_invoices_id_org" UNIQUE("id","org_id"),
	CONSTRAINT "uq_billing_invoices_provider" UNIQUE("provider","provider_invoice_id"),
	CONSTRAINT "billing_invoices_provider" CHECK ("billing_invoices"."provider" = 'stripe'),
	CONSTRAINT "billing_invoices_status" CHECK ("billing_invoices"."status" in ('open','paid','void','uncollectible'))
);
--> statement-breakpoint
ALTER TABLE "billing_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_provider_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_customer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_billing_provider_customers_customer" UNIQUE("provider","customer_id"),
	CONSTRAINT "uq_billing_provider_customers_provider" UNIQUE("provider","provider_customer_id"),
	CONSTRAINT "billing_provider_customers_provider" CHECK ("billing_provider_customers"."provider" = 'stripe')
);
--> statement-breakpoint
ALTER TABLE "billing_provider_customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_provider_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"offer_item_id" uuid NOT NULL,
	"provider_price_id" text NOT NULL,
	"mapped_by" text NOT NULL,
	"mapped_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_billing_provider_prices_item" UNIQUE("provider","offer_item_id"),
	CONSTRAINT "uq_billing_provider_prices_price" UNIQUE("provider","provider_price_id"),
	CONSTRAINT "billing_provider_prices_provider" CHECK ("billing_provider_prices"."provider" = 'stripe'),
	CONSTRAINT "billing_provider_prices_price" CHECK (btrim("billing_provider_prices"."provider_price_id") <> '' and btrim("billing_provider_prices"."mapped_by") <> '')
);
--> statement-breakpoint
ALTER TABLE "billing_provider_prices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contract_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_subscription_id" text NOT NULL,
	"provider_customer_id" text,
	"status" text NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"last_event_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_billing_subscriptions_contract" UNIQUE("contract_id"),
	CONSTRAINT "uq_billing_subscriptions_provider" UNIQUE("provider","provider_subscription_id"),
	CONSTRAINT "billing_subscriptions_provider" CHECK ("billing_subscriptions"."provider" = 'stripe'),
	CONSTRAINT "billing_subscriptions_status" CHECK ("billing_subscriptions"."status" in ('incomplete','incomplete_expired','trialing','active','past_due','unpaid','canceled','paused'))
);
--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "commercial_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contract_id" uuid NOT NULL,
	"company_id" uuid,
	"service" text NOT NULL,
	"status" text NOT NULL,
	"reason" text NOT NULL,
	"applied" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_commercial_entitlements_target" UNIQUE NULLS NOT DISTINCT("contract_id","company_id","service"),
	CONSTRAINT "commercial_entitlements_service" CHECK ("commercial_entitlements"."service" in ('pgr','medicine','pro')),
	CONSTRAINT "commercial_entitlements_status" CHECK ("commercial_entitlements"."status" in ('active','inactive')),
	CONSTRAINT "commercial_entitlements_target" CHECK (("commercial_entitlements"."service" = 'pro') = ("commercial_entitlements"."company_id" is null))
);
--> statement-breakpoint
ALTER TABLE "commercial_entitlements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_checkout_sessions" ADD CONSTRAINT "billing_checkout_sessions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_checkout_sessions" ADD CONSTRAINT "billing_checkout_sessions_contract_fk" FOREIGN KEY ("contract_id","org_id") REFERENCES "public"."commercial_contracts"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_checkout_sessions" ADD CONSTRAINT "billing_checkout_sessions_customer_fk" FOREIGN KEY ("customer_id","org_id") REFERENCES "public"."commercial_customers"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_contract_fk" FOREIGN KEY ("contract_id","org_id") REFERENCES "public"."commercial_contracts"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoice_items" ADD CONSTRAINT "billing_invoice_items_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoice_items" ADD CONSTRAINT "billing_invoice_items_invoice_fk" FOREIGN KEY ("invoice_id","org_id") REFERENCES "public"."billing_invoices"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_contract_fk" FOREIGN KEY ("contract_id","org_id") REFERENCES "public"."commercial_contracts"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_provider_customers" ADD CONSTRAINT "billing_provider_customers_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_provider_customers" ADD CONSTRAINT "billing_provider_customers_customer_fk" FOREIGN KEY ("customer_id","org_id") REFERENCES "public"."commercial_customers"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_provider_prices" ADD CONSTRAINT "billing_provider_prices_offer_item_id_commercial_offer_items_id_fk" FOREIGN KEY ("offer_item_id") REFERENCES "public"."commercial_offer_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_contract_fk" FOREIGN KEY ("contract_id","org_id") REFERENCES "public"."commercial_contracts"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_entitlements" ADD CONSTRAINT "commercial_entitlements_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_entitlements" ADD CONSTRAINT "commercial_entitlements_contract_fk" FOREIGN KEY ("contract_id","org_id") REFERENCES "public"."commercial_contracts"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_entitlements" ADD CONSTRAINT "commercial_entitlements_company_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_billing_checkout_sessions_contract" ON "billing_checkout_sessions" USING btree ("org_id","contract_id");--> statement-breakpoint
CREATE INDEX "idx_billing_events_contract" ON "billing_events" USING btree ("org_id","contract_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_billing_invoices_contract" ON "billing_invoices" USING btree ("org_id","contract_id");--> statement-breakpoint
CREATE INDEX "idx_commercial_entitlements_target" ON "commercial_entitlements" USING btree ("org_id","company_id","service");--> statement-breakpoint
CREATE POLICY "billing_checkout_sessions_tenant" ON "billing_checkout_sessions" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "billing_checkout_sessions_reference" ON "billing_checkout_sessions" AS PERMISSIVE FOR SELECT TO "app_runtime" USING (nullif(current_setting('app.current_actor',true),'') is null and "billing_checkout_sessions"."id"::text = nullif(current_setting('app.billing_reference',true),''));--> statement-breakpoint
CREATE POLICY "billing_checkout_sessions_reader" ON "billing_checkout_sessions" AS RESTRICTIVE FOR SELECT TO "app_runtime" USING ((nullif(current_setting('app.current_actor',true),'') is null or exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=nullif(current_setting('app.current_actor',true),'') and m.role in ('owner','org:admin'))));--> statement-breakpoint
CREATE POLICY "billing_checkout_sessions_author" ON "billing_checkout_sessions" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK (exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=nullif(current_setting('app.current_actor',true),'') and m.role in ('owner','org:admin')) and "billing_checkout_sessions"."created_by"=nullif(current_setting('app.current_actor',true),''));--> statement-breakpoint
CREATE POLICY "billing_checkout_sessions_provider_event" ON "billing_checkout_sessions" AS RESTRICTIVE FOR UPDATE TO "app_runtime" USING (nullif(current_setting('app.current_actor',true),'') is null) WITH CHECK (nullif(current_setting('app.current_actor',true),'') is null);--> statement-breakpoint
CREATE POLICY "billing_events_tenant" ON "billing_events" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "billing_events_provider_event" ON "billing_events" AS RESTRICTIVE FOR ALL TO "app_runtime" USING ((nullif(current_setting('app.current_actor',true),'') is null or exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=nullif(current_setting('app.current_actor',true),'') and m.role in ('owner','org:admin')))) WITH CHECK (nullif(current_setting('app.current_actor',true),'') is null);--> statement-breakpoint
CREATE POLICY "billing_invoice_items_tenant" ON "billing_invoice_items" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "billing_invoice_items_provider_event" ON "billing_invoice_items" AS RESTRICTIVE FOR ALL TO "app_runtime" USING ((nullif(current_setting('app.current_actor',true),'') is null or exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=nullif(current_setting('app.current_actor',true),'') and m.role in ('owner','org:admin')))) WITH CHECK (nullif(current_setting('app.current_actor',true),'') is null);--> statement-breakpoint
CREATE POLICY "billing_invoices_tenant" ON "billing_invoices" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "billing_invoices_provider_event" ON "billing_invoices" AS RESTRICTIVE FOR ALL TO "app_runtime" USING ((nullif(current_setting('app.current_actor',true),'') is null or exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=nullif(current_setting('app.current_actor',true),'') and m.role in ('owner','org:admin')))) WITH CHECK (nullif(current_setting('app.current_actor',true),'') is null);--> statement-breakpoint
CREATE POLICY "billing_provider_customers_tenant" ON "billing_provider_customers" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "billing_provider_customers_provider_event" ON "billing_provider_customers" AS RESTRICTIVE FOR ALL TO "app_runtime" USING ((nullif(current_setting('app.current_actor',true),'') is null or exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=nullif(current_setting('app.current_actor',true),'') and m.role in ('owner','org:admin')))) WITH CHECK (nullif(current_setting('app.current_actor',true),'') is null);--> statement-breakpoint
CREATE POLICY "billing_provider_prices_read" ON "billing_provider_prices" AS PERMISSIVE FOR SELECT TO "app_runtime" USING (true);--> statement-breakpoint
CREATE POLICY "billing_subscriptions_tenant" ON "billing_subscriptions" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "billing_subscriptions_provider_event" ON "billing_subscriptions" AS RESTRICTIVE FOR ALL TO "app_runtime" USING ((nullif(current_setting('app.current_actor',true),'') is null or exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=nullif(current_setting('app.current_actor',true),'') and m.role in ('owner','org:admin')))) WITH CHECK (nullif(current_setting('app.current_actor',true),'') is null);--> statement-breakpoint
CREATE POLICY "billing_subscriptions_reference" ON "billing_subscriptions" AS PERMISSIVE FOR SELECT TO "app_runtime" USING (nullif(current_setting('app.current_actor',true),'') is null and "billing_subscriptions"."provider_subscription_id" = nullif(current_setting('app.billing_reference',true),''));--> statement-breakpoint
CREATE POLICY "commercial_entitlements_tenant" ON "commercial_entitlements" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "commercial_entitlements_provider_event" ON "commercial_entitlements" AS RESTRICTIVE FOR ALL TO "app_runtime" USING ((nullif(current_setting('app.current_actor',true),'') is null or exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=nullif(current_setting('app.current_actor',true),'') and m.role in ('owner','org:admin')))) WITH CHECK (nullif(current_setting('app.current_actor',true),'') is null);--> statement-breakpoint
CREATE POLICY "commercial_entitlements_actor_scope" ON "commercial_entitlements" AS RESTRICTIVE FOR SELECT TO "app_runtime" USING (("commercial_entitlements"."company_id" is null or (nullif(current_setting('app.current_actor', true), '') is null or exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = nullif(current_setting('app.current_actor', true), '') and m.role in ('owner','org:admin')) or not exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '')) or exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '') and s.company_id = "commercial_entitlements"."company_id"))));--> statement-breakpoint
CREATE FUNCTION public.commercial_reconcile_grant(p_entitlement uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  e public.commercial_entitlements%ROWTYPE;
  v_active boolean;
  v_managed boolean;
  v_enabled boolean;
  v_grant boolean;
BEGIN
  IF nullif(current_setting('app.current_actor', true), '') IS NOT NULL THEN
    RAISE EXCEPTION 'commercial grants follow provider events only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO e FROM public.commercial_entitlements
    WHERE id = p_entitlement AND org_id = current_setting('app.current_org', true);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entitlement not found in the current office' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'commercial_grant:' || e.org_id || ':' || coalesce(e.company_id::text, '') || ':' || e.service, 0));
  SELECT coalesce(bool_or(t.status = 'active'), false), coalesce(bool_or(t.applied), false)
    INTO v_active, v_managed
    FROM public.commercial_entitlements t
    WHERE t.org_id = e.org_id AND t.service = e.service AND t.company_id IS NOT DISTINCT FROM e.company_id;
  IF e.service = 'pro' THEN
    SELECT o.plan = 'pro' INTO v_enabled FROM public.orgs o WHERE o.id = e.org_id;
  ELSE
    SELECT m.enabled INTO v_enabled FROM public.company_modules m
      WHERE m.org_id = e.org_id AND m.company_id = e.company_id AND m.module = e.service;
  END IF;
  v_enabled := coalesce(v_enabled, false);
  IF e.status = 'active' AND NOT v_managed AND NOT v_enabled THEN
    v_grant := true;
  ELSIF NOT v_active AND v_managed THEN
    v_grant := false;
  ELSE
    RETURN 'kept';
  END IF;
  IF e.service = 'pro' THEN
    UPDATE public.orgs SET plan = CASE WHEN v_grant THEN 'pro' ELSE 'free' END WHERE id = e.org_id;
  ELSIF v_enabled IS DISTINCT FROM v_grant THEN
    INSERT INTO public.company_modules (org_id, company_id, module, enabled)
      VALUES (e.org_id, e.company_id, e.service, v_grant)
      ON CONFLICT (org_id, company_id, module) DO UPDATE SET enabled = excluded.enabled, updated_at = now();
    INSERT INTO public.company_module_events (org_id, company_id, module, previous_enabled, enabled, changed_by, reason)
      VALUES (e.org_id, e.company_id, e.service, v_enabled, v_grant, 'system:commercial-billing',
        'Direito de uso da contratação ' || e.contract_id || ': ' || e.reason);
  END IF;
  UPDATE public.commercial_entitlements t SET applied = v_grant
    WHERE t.org_id = e.org_id AND t.service = e.service AND t.company_id IS NOT DISTINCT FROM e.company_id
      AND (t.id = e.id OR NOT v_grant);
  RETURN CASE WHEN v_grant THEN 'granted' ELSE 'revoked' END;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.commercial_reconcile_grant(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.commercial_reconcile_grant(uuid) TO app_runtime;
--> statement-breakpoint
CREATE TRIGGER set_updated_at_billing_subscriptions BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_commercial_entitlements BEFORE UPDATE ON public.commercial_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER set_updated_at_billing_invoices BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
GRANT SELECT ON public.billing_provider_prices TO app_runtime;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON public.billing_provider_prices FROM app_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.billing_provider_customers, public.billing_checkout_sessions, public.billing_subscriptions, public.billing_events, public.commercial_entitlements, public.billing_invoices, public.billing_invoice_items TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.billing_provider_customers, public.billing_checkout_sessions, public.billing_subscriptions, public.billing_events, public.commercial_entitlements, public.billing_invoices, public.billing_invoice_items FROM app_runtime;
--> statement-breakpoint
GRANT UPDATE (status, completed_at) ON public.billing_checkout_sessions TO app_runtime;
--> statement-breakpoint
GRANT UPDATE (provider_customer_id, status, current_period_start, current_period_end, cancel_at_period_end, canceled_at, last_event_at) ON public.billing_subscriptions TO app_runtime;
--> statement-breakpoint
GRANT UPDATE (status, reason) ON public.commercial_entitlements TO app_runtime;
--> statement-breakpoint
GRANT UPDATE (status, total_cents, due_at, paid_at, last_event_at) ON public.billing_invoices TO app_runtime;
