CREATE FUNCTION public.billing_paid_product(target_org text,target_company uuid,target_product text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT current_setting('app.billing_simulation',true)='true' AND target_org=current_setting('app.current_org',true)
 AND EXISTS (SELECT 1 FROM public.billing_entitlements e JOIN public.billing_contracts c ON c.id=e.contract_id AND c.org_id=e.org_id
 WHERE e.org_id=target_org AND e.company_id=target_company AND e.product=target_product AND e.scope='subscription' AND e.active AND e.valid_until>now()
 AND c.period_end>now() AND (c.status='active' OR (c.status='past_due' AND c.snapshot->'policy'->>'pastDueAccess'='preserve_until_period_end')));
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.billing_paid_product(text,uuid,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.billing_paid_product(text,uuid,text) TO app_runtime;
--> statement-breakpoint
-- Narrow boolean lookup: does not expose financial rows to operational staff.
CREATE FUNCTION public.billing_tenant_pro_allowed(target_org text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT target_org=current_setting('app.current_org',true) AND EXISTS (
  SELECT 1 FROM public.companies c WHERE c.org_id=target_org AND public.billing_paid_product(target_org,c.id,'pro')
 );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.billing_tenant_pro_allowed(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.billing_tenant_pro_allowed(text) TO app_runtime;
--> statement-breakpoint
-- Narrow boolean lookup: does not expose financial rows to operational staff.
CREATE FUNCTION public.billing_pgr_export_allowed(target_org text,target_pgr uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT target_org=current_setting('app.current_org',true) AND
 (current_setting('app.billing_simulation',true) IS DISTINCT FROM 'true' OR NOT EXISTS (
   SELECT 1 FROM public.pgr p WHERE p.id=target_pgr AND p.org_id=target_org AND (
    EXISTS (SELECT 1 FROM public.company_modules m WHERE m.org_id=target_org AND m.company_id=p.company_id AND m.module='pgr' AND NOT m.enabled)
    OR (NOT public.billing_paid_product(target_org,p.company_id,'pgr') AND (
      EXISTS (SELECT 1 FROM public.billing_trials t WHERE t.org_id=target_org AND t.company_id=p.company_id)
      OR NOT EXISTS (SELECT 1 FROM public.company_modules m WHERE m.org_id=target_org AND m.company_id=p.company_id AND m.module='pgr' AND m.enabled)
    ))
   )
 ));
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.billing_pgr_export_allowed(text,uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.billing_pgr_export_allowed(text,uuid) TO app_runtime;
--> statement-breakpoint
-- Narrow boolean lookup: does not expose financial rows to operational staff.
-- Existing manual grants take precedence in the enclosing policies.
CREATE FUNCTION public.billing_module_allowed(target_org text,target_company uuid,target_module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT current_setting('app.billing_simulation',true)='true'
 AND target_org=current_setting('app.current_org',true)
 AND target_module IN ('pgr','medicine')
 AND (
   EXISTS (
     SELECT 1 FROM public.billing_entitlements e
     JOIN public.billing_contracts c ON c.id=e.contract_id AND c.org_id=e.org_id
     WHERE e.org_id=target_org AND e.company_id=target_company AND e.product=target_module
       AND e.scope='subscription' AND e.active AND e.valid_until>now()
       AND c.period_end>now() AND (c.status='active' OR (c.status='past_due' AND c.snapshot->'policy'->>'pastDueAccess'='preserve_until_period_end'))
       AND NOT EXISTS (SELECT 1 FROM public.company_modules m WHERE m.org_id=target_org AND m.company_id=target_company AND m.module=target_module AND NOT m.enabled)
   ) OR EXISTS (
     SELECT 1 FROM public.billing_trials t WHERE t.org_id=target_org AND t.company_id=target_company AND t.ends_at>now() AND t.converted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.company_modules m WHERE m.org_id=target_org AND m.company_id=target_company AND m.module=target_module AND NOT m.enabled)
   )
 );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.billing_module_allowed(text,uuid,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.billing_module_allowed(text,uuid,text) TO app_runtime;
--> statement-breakpoint
CREATE POLICY "billing_trials_tenant_read" ON "billing_trials" AS PERMISSIVE FOR SELECT TO "app_runtime" USING (org_id=current_setting('app.current_org',true));--> statement-breakpoint
ALTER POLICY "health_exams_module_access" ON "health_exams" TO app_runtime USING (exists (select 1 from public.employees e where e.id = "health_exams"."employee_id" and e.org_id = "health_exams"."org_id" and (exists (select 1 from public.company_modules cm where cm.org_id = "health_exams"."org_id" and cm.company_id = e.company_id and cm.module = 'medicine' and cm.enabled = true) or (current_setting('app.billing_simulation',true)='true' and public.billing_module_allowed("health_exams"."org_id",e.company_id,'medicine'))))) WITH CHECK (exists (select 1 from public.employees e where e.id = "health_exams"."employee_id" and e.org_id = "health_exams"."org_id" and (exists (select 1 from public.company_modules cm where cm.org_id = "health_exams"."org_id" and cm.company_id = e.company_id and cm.module = 'medicine' and cm.enabled = true) or (current_setting('app.billing_simulation',true)='true' and public.billing_module_allowed("health_exams"."org_id",e.company_id,'medicine')))));--> statement-breakpoint
ALTER POLICY "machine_installations_module" ON "machine_installations" TO app_runtime USING ((exists (select 1 from public.company_modules cm where cm.org_id = "machine_installations"."org_id" and cm.company_id = "machine_installations"."company_id" and cm.module = 'pgr' and cm.enabled = true) or (current_setting('app.billing_simulation',true)='true' and public.billing_module_allowed("machine_installations"."org_id","machine_installations"."company_id",'pgr')))) WITH CHECK ((exists (select 1 from public.company_modules cm where cm.org_id = "machine_installations"."org_id" and cm.company_id = "machine_installations"."company_id" and cm.module = 'pgr' and cm.enabled = true) or (current_setting('app.billing_simulation',true)='true' and public.billing_module_allowed("machine_installations"."org_id","machine_installations"."company_id",'pgr'))));--> statement-breakpoint
ALTER POLICY "medical_risk_entries_module_access" ON "medical_risk_entries" TO app_runtime USING ((exists (select 1 from public.company_modules cm where cm.org_id = "medical_risk_entries"."org_id" and cm.company_id = "medical_risk_entries"."company_id" and cm.module = 'medicine' and cm.enabled = true) or (current_setting('app.billing_simulation',true)='true' and public.billing_module_allowed("medical_risk_entries"."org_id","medical_risk_entries"."company_id",'medicine')))) WITH CHECK ((exists (select 1 from public.company_modules cm where cm.org_id = "medical_risk_entries"."org_id" and cm.company_id = "medical_risk_entries"."company_id" and cm.module = 'medicine' and cm.enabled = true) or (current_setting('app.billing_simulation',true)='true' and public.billing_module_allowed("medical_risk_entries"."org_id","medical_risk_entries"."company_id",'medicine'))));--> statement-breakpoint
ALTER POLICY "medical_risk_events_module_access" ON "medical_risk_events" TO app_runtime USING ((exists (select 1 from public.company_modules cm where cm.org_id = "medical_risk_events"."org_id" and cm.company_id = "medical_risk_events"."company_id" and cm.module = 'medicine' and cm.enabled = true) or (current_setting('app.billing_simulation',true)='true' and public.billing_module_allowed("medical_risk_events"."org_id","medical_risk_events"."company_id",'medicine')))) WITH CHECK ((exists (select 1 from public.company_modules cm where cm.org_id = "medical_risk_events"."org_id" and cm.company_id = "medical_risk_events"."company_id" and cm.module = 'medicine' and cm.enabled = true) or (current_setting('app.billing_simulation',true)='true' and public.billing_module_allowed("medical_risk_events"."org_id","medical_risk_events"."company_id",'medicine'))));--> statement-breakpoint
ALTER POLICY "medical_sources_module_access" ON "medical_risk_sources" TO app_runtime USING ((exists (select 1 from public.company_modules cm where cm.org_id = "medical_risk_sources"."org_id" and cm.company_id = "medical_risk_sources"."company_id" and cm.module = 'medicine' and cm.enabled = true) or (current_setting('app.billing_simulation',true)='true' and public.billing_module_allowed("medical_risk_sources"."org_id","medical_risk_sources"."company_id",'medicine')))) WITH CHECK ((exists (select 1 from public.company_modules cm where cm.org_id = "medical_risk_sources"."org_id" and cm.company_id = "medical_risk_sources"."company_id" and cm.module = 'medicine' and cm.enabled = true) or (current_setting('app.billing_simulation',true)='true' and public.billing_module_allowed("medical_risk_sources"."org_id","medical_risk_sources"."company_id",'medicine'))));--> statement-breakpoint
ALTER POLICY "pgr_module_access" ON "pgr" TO app_runtime USING ((exists (select 1 from public.company_modules cm where cm.org_id = "pgr"."org_id" and cm.company_id = "pgr"."company_id" and cm.module = 'pgr' and cm.enabled = true) or (current_setting('app.billing_simulation',true)='true' and public.billing_module_allowed("pgr"."org_id","pgr"."company_id",'pgr')))) WITH CHECK ((exists (select 1 from public.company_modules cm where cm.org_id = "pgr"."org_id" and cm.company_id = "pgr"."company_id" and cm.module = 'pgr' and cm.enabled = true) or (current_setting('app.billing_simulation',true)='true' and public.billing_module_allowed("pgr"."org_id","pgr"."company_id",'pgr'))));--> statement-breakpoint
ALTER POLICY "risks_module_access" ON "risks" TO app_runtime USING (exists (select 1 from public.ges g where g.id = "risks"."ges_id" and g.org_id = "risks"."org_id" and (exists (select 1 from public.company_modules cm where cm.org_id = "risks"."org_id" and cm.company_id = g.company_id and cm.module = 'pgr' and cm.enabled = true) or (current_setting('app.billing_simulation',true)='true' and public.billing_module_allowed("risks"."org_id",g.company_id,'pgr'))))) WITH CHECK (exists (select 1 from public.ges g where g.id = "risks"."ges_id" and g.org_id = "risks"."org_id" and (exists (select 1 from public.company_modules cm where cm.org_id = "risks"."org_id" and cm.company_id = g.company_id and cm.module = 'pgr' and cm.enabled = true) or (current_setting('app.billing_simulation',true)='true' and public.billing_module_allowed("risks"."org_id",g.company_id,'pgr')))));

--> statement-breakpoint
ALTER TABLE "billing_invoices" ADD COLUMN "provider_invoice_id" text;
--> statement-breakpoint
UPDATE "billing_invoices" SET "provider_invoice_id"="event_id" WHERE "provider_invoice_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "billing_invoices" ALTER COLUMN "provider_invoice_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_invoices" ADD COLUMN "items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_invoices" ADD CONSTRAINT "uq_billing_provider_invoice" UNIQUE("org_id","provider_invoice_id");
--> statement-breakpoint
ALTER TABLE "billing_invoices" ADD COLUMN "period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_invoices" ADD COLUMN "period_end" timestamp with time zone;
