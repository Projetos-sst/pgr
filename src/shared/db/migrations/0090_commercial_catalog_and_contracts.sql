CREATE TABLE "commercial_contract_companies" (
	"org_id" text NOT NULL,
	"contract_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	CONSTRAINT "commercial_contract_companies_pk" PRIMARY KEY("contract_id","company_id")
);
--> statement-breakpoint
ALTER TABLE "commercial_contract_companies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "commercial_contract_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contract_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"service" text NOT NULL,
	"label" text NOT NULL,
	"unit" text NOT NULL,
	"unit_amount_cents" integer NOT NULL,
	CONSTRAINT "uq_commercial_contract_items_position" UNIQUE("contract_id","position"),
	CONSTRAINT "commercial_contract_items_position" CHECK ("commercial_contract_items"."position" > 0),
	CONSTRAINT "commercial_contract_items_service" CHECK ("commercial_contract_items"."service" in ('pgr','medicine','pro','one_off')),
	CONSTRAINT "commercial_contract_items_unit" CHECK ("commercial_contract_items"."unit" in ('organization','company','employee','document')),
	CONSTRAINT "commercial_contract_items_amount" CHECK ("commercial_contract_items"."unit_amount_cents" between 0 and 100000000)
);
--> statement-breakpoint
ALTER TABLE "commercial_contract_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "commercial_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "commercial_contracts_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"org_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"offer_version_id" uuid NOT NULL,
	"customer_kind" text NOT NULL,
	"customer_legal_name" text NOT NULL,
	"customer_tax_id" text NOT NULL,
	"offer_code" text NOT NULL,
	"offer_version" integer NOT NULL,
	"offer_name" text NOT NULL,
	"offer_scope" text NOT NULL,
	"currency" text NOT NULL,
	"billing_period" text NOT NULL,
	"quotas" jsonb NOT NULL,
	"fictitious" boolean NOT NULL,
	"term_start" date NOT NULL,
	"term_end" date,
	"contracted_by" text NOT NULL,
	"contracted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_commercial_contracts_id_org" UNIQUE("id","org_id"),
	CONSTRAINT "commercial_contracts_customer_kind" CHECK ("commercial_contracts"."customer_kind" in ('office','company')),
	CONSTRAINT "commercial_contracts_scope" CHECK ("commercial_contracts"."offer_scope" in ('organization','company')),
	CONSTRAINT "commercial_contracts_currency" CHECK ("commercial_contracts"."currency" = 'BRL'),
	CONSTRAINT "commercial_contracts_period" CHECK ("commercial_contracts"."billing_period" in ('monthly','annual','one_time')),
	CONSTRAINT "commercial_contracts_term" CHECK ("commercial_contracts"."term_end" is null or "commercial_contracts"."term_end" >= "commercial_contracts"."term_start")
);
--> statement-breakpoint
ALTER TABLE "commercial_contracts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "commercial_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"kind" text NOT NULL,
	"company_id" uuid,
	"legal_name" text,
	"tax_id" text,
	"billing_email" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_commercial_customers_id_org" UNIQUE("id","org_id"),
	CONSTRAINT "uq_commercial_customers_company" UNIQUE("org_id","company_id"),
	CONSTRAINT "commercial_customers_kind" CHECK ("commercial_customers"."kind" in ('office','company')),
	CONSTRAINT "commercial_customers_status" CHECK ("commercial_customers"."status" in ('active','inactive')),
	CONSTRAINT "commercial_customers_identity" CHECK (case "commercial_customers"."kind"
        when 'company' then "commercial_customers"."company_id" is not null and "commercial_customers"."legal_name" is null and "commercial_customers"."tax_id" is null
        else "commercial_customers"."company_id" is null and btrim(coalesce("commercial_customers"."legal_name",'')) <> '' and coalesce("commercial_customers"."tax_id",'') ~ '^([0-9]{11}|[0-9]{14})$'
      end)
);
--> statement-breakpoint
ALTER TABLE "commercial_customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "commercial_offer_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_version_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"service" text NOT NULL,
	"label" text NOT NULL,
	"unit" text NOT NULL,
	"unit_amount_cents" integer NOT NULL,
	CONSTRAINT "uq_commercial_offer_items_position" UNIQUE("offer_version_id","position"),
	CONSTRAINT "uq_commercial_offer_items_label" UNIQUE("offer_version_id","label"),
	CONSTRAINT "commercial_offer_items_position" CHECK ("commercial_offer_items"."position" > 0),
	CONSTRAINT "commercial_offer_items_service" CHECK ("commercial_offer_items"."service" in ('pgr','medicine','pro','one_off')),
	CONSTRAINT "commercial_offer_items_unit" CHECK ("commercial_offer_items"."unit" in ('organization','company','employee','document')),
	CONSTRAINT "commercial_offer_items_amount" CHECK ("commercial_offer_items"."unit_amount_cents" between 0 and 100000000)
);
--> statement-breakpoint
ALTER TABLE "commercial_offer_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "commercial_offer_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"scope" text NOT NULL,
	"currency" text NOT NULL,
	"billing_period" text NOT NULL,
	"quotas" jsonb NOT NULL,
	"valid_from" date NOT NULL,
	"valid_until" date,
	"fictitious" boolean NOT NULL,
	"approval_reference" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" text,
	"deactivated_at" timestamp with time zone,
	"deactivated_by" text,
	"deactivation_reason" text,
	CONSTRAINT "uq_commercial_offer_versions_code_version" UNIQUE("code","version"),
	CONSTRAINT "commercial_offer_versions_version" CHECK ("commercial_offer_versions"."version" > 0),
	CONSTRAINT "commercial_offer_versions_scope" CHECK ("commercial_offer_versions"."scope" in ('organization','company')),
	CONSTRAINT "commercial_offer_versions_currency" CHECK ("commercial_offer_versions"."currency" = 'BRL'),
	CONSTRAINT "commercial_offer_versions_period" CHECK ("commercial_offer_versions"."billing_period" in ('monthly','annual','one_time')),
	CONSTRAINT "commercial_offer_versions_validity" CHECK ("commercial_offer_versions"."valid_until" is null or "commercial_offer_versions"."valid_until" >= "commercial_offer_versions"."valid_from"),
	CONSTRAINT "commercial_offer_versions_fictitious_code" CHECK ("commercial_offer_versions"."fictitious" = ("commercial_offer_versions"."code" like 'ficticio-%')),
	CONSTRAINT "commercial_offer_versions_approval" CHECK (case when "commercial_offer_versions"."fictitious" then "commercial_offer_versions"."approval_reference" is null else btrim(coalesce("commercial_offer_versions"."approval_reference",'')) <> '' end),
	CONSTRAINT "commercial_offer_versions_publication" CHECK (("commercial_offer_versions"."published_at" is null) = ("commercial_offer_versions"."published_by" is null)),
	CONSTRAINT "commercial_offer_versions_deactivation" CHECK (case when "commercial_offer_versions"."deactivated_at" is null then "commercial_offer_versions"."deactivated_by" is null and "commercial_offer_versions"."deactivation_reason" is null else "commercial_offer_versions"."published_at" is not null and "commercial_offer_versions"."deactivated_by" is not null and btrim(coalesce("commercial_offer_versions"."deactivation_reason",'')) <> '' end)
);
--> statement-breakpoint
ALTER TABLE "commercial_offer_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "commercial_contract_companies" ADD CONSTRAINT "commercial_contract_companies_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_contract_companies" ADD CONSTRAINT "commercial_contract_companies_contract_fk" FOREIGN KEY ("contract_id","org_id") REFERENCES "public"."commercial_contracts"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_contract_companies" ADD CONSTRAINT "commercial_contract_companies_company_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_contract_items" ADD CONSTRAINT "commercial_contract_items_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_contract_items" ADD CONSTRAINT "commercial_contract_items_contract_fk" FOREIGN KEY ("contract_id","org_id") REFERENCES "public"."commercial_contracts"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_contracts" ADD CONSTRAINT "commercial_contracts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_contracts" ADD CONSTRAINT "commercial_contracts_offer_version_id_commercial_offer_versions_id_fk" FOREIGN KEY ("offer_version_id") REFERENCES "public"."commercial_offer_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_contracts" ADD CONSTRAINT "commercial_contracts_customer_fk" FOREIGN KEY ("customer_id","org_id") REFERENCES "public"."commercial_customers"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_customers" ADD CONSTRAINT "commercial_customers_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_customers" ADD CONSTRAINT "commercial_customers_company_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_offer_items" ADD CONSTRAINT "commercial_offer_items_offer_version_id_commercial_offer_versions_id_fk" FOREIGN KEY ("offer_version_id") REFERENCES "public"."commercial_offer_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_commercial_contract_companies_company" ON "commercial_contract_companies" USING btree ("org_id","company_id");--> statement-breakpoint
CREATE INDEX "idx_commercial_contracts_org_seq" ON "commercial_contracts" USING btree ("org_id","seq");--> statement-breakpoint
CREATE INDEX "idx_commercial_contracts_customer" ON "commercial_contracts" USING btree ("org_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_commercial_customers_office" ON "commercial_customers" USING btree ("org_id") WHERE "commercial_customers"."kind" = 'office';--> statement-breakpoint
CREATE POLICY "commercial_contract_companies_tenant" ON "commercial_contract_companies" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "commercial_contract_companies_administrator" ON "commercial_contract_companies" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) WITH CHECK (exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
CREATE POLICY "commercial_contract_companies_actor_scope" ON "commercial_contract_companies" AS RESTRICTIVE FOR SELECT TO "app_runtime" USING ((nullif(current_setting('app.current_actor', true), '') is null or exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = nullif(current_setting('app.current_actor', true), '') and m.role in ('owner','org:admin')) or not exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '')) or exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '') and s.company_id = "commercial_contract_companies"."company_id")));--> statement-breakpoint
CREATE POLICY "commercial_contract_items_tenant" ON "commercial_contract_items" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "commercial_contract_items_administrator" ON "commercial_contract_items" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) WITH CHECK (exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
CREATE POLICY "commercial_contracts_tenant" ON "commercial_contracts" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "commercial_contracts_administrator" ON "commercial_contracts" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) WITH CHECK (exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
CREATE POLICY "commercial_contracts_actor" ON "commercial_contracts" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("commercial_contracts"."contracted_by"=current_setting('app.current_actor',true));--> statement-breakpoint
CREATE POLICY "commercial_customers_tenant" ON "commercial_customers" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id=current_setting('app.current_org',true)) WITH CHECK (org_id=current_setting('app.current_org',true));--> statement-breakpoint
CREATE POLICY "commercial_customers_administrator" ON "commercial_customers" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) WITH CHECK (exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin')));--> statement-breakpoint
CREATE POLICY "commercial_customers_actor_scope" ON "commercial_customers" AS RESTRICTIVE FOR SELECT TO "app_runtime" USING (("commercial_customers"."company_id" is null or (nullif(current_setting('app.current_actor', true), '') is null or exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = nullif(current_setting('app.current_actor', true), '') and m.role in ('owner','org:admin')) or not exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '')) or exists (select 1 from public.member_access_scopes s where s.org_id = current_setting('app.current_org', true) and s.user_id = nullif(current_setting('app.current_actor', true), '') and s.company_id = "commercial_customers"."company_id"))));--> statement-breakpoint
CREATE POLICY "commercial_customers_actor" ON "commercial_customers" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("commercial_customers"."created_by"=current_setting('app.current_actor',true));--> statement-breakpoint
CREATE POLICY "commercial_offer_items_published_read" ON "commercial_offer_items" AS PERMISSIVE FOR SELECT TO "app_runtime" USING (exists(select 1 from public.commercial_offer_versions v where v.id="commercial_offer_items"."offer_version_id" and v.published_at is not null));--> statement-breakpoint
CREATE POLICY "commercial_offer_versions_published_read" ON "commercial_offer_versions" AS PERMISSIVE FOR SELECT TO "app_runtime" USING ("commercial_offer_versions"."published_at" is not null);--> statement-breakpoint
CREATE FUNCTION public.commercial_offer_versions_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  lifecycle text[] := ARRAY['published_at','published_by','deactivated_at','deactivated_by','deactivation_reason'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'commercial offer versions are never deleted' USING ERRCODE = 'check_violation';
  END IF;
  IF (to_jsonb(NEW) - lifecycle) IS DISTINCT FROM (to_jsonb(OLD) - lifecycle) THEN
    RAISE EXCEPTION 'commercial offer version content is immutable' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.published_at IS NOT NULL AND ROW(NEW.published_at, NEW.published_by) IS DISTINCT FROM ROW(OLD.published_at, OLD.published_by) THEN
    RAISE EXCEPTION 'commercial offer version is already published' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.deactivated_at IS NOT NULL AND ROW(NEW.deactivated_at, NEW.deactivated_by, NEW.deactivation_reason) IS DISTINCT FROM ROW(OLD.deactivated_at, OLD.deactivated_by, OLD.deactivation_reason) THEN
    RAISE EXCEPTION 'commercial offer version is already deactivated' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.published_at IS NULL AND NEW.published_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.commercial_offer_items i WHERE i.offer_version_id = NEW.id) THEN
    RAISE EXCEPTION 'commercial offer version has no items to publish' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER commercial_offer_versions_guard BEFORE UPDATE OR DELETE ON public.commercial_offer_versions
  FOR EACH ROW EXECUTE FUNCTION public.commercial_offer_versions_guard();
--> statement-breakpoint
CREATE FUNCTION public.commercial_offer_items_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'commercial offer items are immutable' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.commercial_offer_versions v WHERE v.id = NEW.offer_version_id AND v.published_at IS NOT NULL) THEN
    RAISE EXCEPTION 'published commercial offer version accepts no new items' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER commercial_offer_items_guard BEFORE INSERT OR UPDATE OR DELETE ON public.commercial_offer_items
  FOR EACH ROW EXECUTE FUNCTION public.commercial_offer_items_guard();
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.commercial_offer_versions_guard(), public.commercial_offer_items_guard() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER set_updated_at_commercial_customers BEFORE UPDATE ON public.commercial_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
GRANT SELECT ON public.commercial_offer_versions, public.commercial_offer_items TO app_runtime;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON public.commercial_offer_versions, public.commercial_offer_items FROM app_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.commercial_customers TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.commercial_customers FROM app_runtime;
--> statement-breakpoint
GRANT UPDATE (billing_email, status, legal_name, tax_id) ON public.commercial_customers TO app_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.commercial_contracts, public.commercial_contract_items, public.commercial_contract_companies TO app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.commercial_contracts, public.commercial_contract_items, public.commercial_contract_companies FROM app_runtime;
