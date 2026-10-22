-- Preserve the original 15-day window for modules not purchased in a partial conversion.
CREATE OR REPLACE FUNCTION public.billing_module_allowed(target_org text,target_company uuid,target_module text)
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
     SELECT 1 FROM public.billing_trials t WHERE t.org_id=target_org AND t.company_id=target_company AND t.ends_at>now()
       AND NOT EXISTS (SELECT 1 FROM public.company_modules m WHERE m.org_id=target_org AND m.company_id=target_company AND m.module=target_module AND NOT m.enabled)
   )
 );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.billing_module_allowed(text,uuid,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.billing_module_allowed(text,uuid,text) TO app_runtime;
--> statement-breakpoint
CREATE FUNCTION public.billing_company_export_allowed(target_org text,target_company uuid,target_product text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT target_org=current_setting('app.current_org',true) AND target_product IN ('pgr','medicine') AND (
 current_setting('app.billing_simulation',true) IS DISTINCT FROM 'true' OR (
 EXISTS(SELECT 1 FROM public.companies c WHERE c.id=target_company AND c.org_id=target_org)
 AND NOT EXISTS(SELECT 1 FROM public.company_modules m WHERE m.org_id=target_org AND m.company_id=target_company AND m.module=target_product AND NOT m.enabled)
 AND (public.billing_paid_product(target_org,target_company,target_product) OR (
 NOT EXISTS(SELECT 1 FROM public.billing_trials t WHERE t.org_id=target_org AND t.company_id=target_company)
 AND EXISTS(SELECT 1 FROM public.company_modules m WHERE m.org_id=target_org AND m.company_id=target_company AND m.module=target_product AND m.enabled)
 ))));
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.billing_company_export_allowed(text,uuid,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.billing_company_export_allowed(text,uuid,text) TO app_runtime;
