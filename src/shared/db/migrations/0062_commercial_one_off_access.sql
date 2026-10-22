-- Operational staff receive only a boolean commercial authorization, not financial rows.
CREATE FUNCTION public.billing_order_service_allowed(target_org text,target_order uuid,target_company uuid,target_product text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT current_setting('app.billing_simulation',true)='true'
 AND target_org=current_setting('app.current_org',true) AND target_product IN ('pgr','medicine')
 AND EXISTS (SELECT 1 FROM public.org_memberships m WHERE m.org_id=target_org AND m.user_id=current_setting('app.current_actor',true) AND m.role IN ('owner','collaborator','org:admin','org:member'))
 AND EXISTS (
   SELECT 1 FROM public.billing_contracts c JOIN public.billing_entitlements e ON e.contract_id=c.id AND e.org_id=c.org_id
   JOIN public.billing_customers b ON b.id=c.customer_id AND b.org_id=c.org_id
   WHERE c.id=target_order AND c.org_id=target_org AND b.company_id=target_company
     AND c.snapshot->>'interval'='one_time' AND c.status='active' AND c.period_end>now()
     AND e.product=target_product AND e.company_id=target_company AND e.scope='order:'||c.id::text AND e.active AND e.valid_until>now()
     AND EXISTS(SELECT 1 FROM public.billing_invoices i WHERE i.org_id=c.org_id AND i.contract_id=c.id AND i.status='paid')
 );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.billing_order_service_allowed(text,uuid,uuid,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.billing_order_service_allowed(text,uuid,uuid,text) TO app_runtime;
--> statement-breakpoint
-- Historical amounts/identity/items and the trial clock cannot be rewritten by runtime.
REVOKE UPDATE ON public.billing_invoices,public.billing_trials,public.billing_customers,public.billing_entitlements,public.billing_change_quotes,public.billing_interests,public.billing_provider_states FROM app_runtime;
--> statement-breakpoint
GRANT UPDATE(status) ON public.billing_invoices TO app_runtime;
--> statement-breakpoint
GRANT UPDATE(converted_at) ON public.billing_trials TO app_runtime;
--> statement-breakpoint
GRANT UPDATE(name,provider_customer_id) ON public.billing_customers TO app_runtime;
--> statement-breakpoint
GRANT UPDATE(active,valid_until) ON public.billing_entitlements TO app_runtime;
--> statement-breakpoint
GRANT UPDATE(confirmed_at) ON public.billing_change_quotes TO app_runtime;
--> statement-breakpoint
GRANT UPDATE(acknowledged_at) ON public.billing_interests TO app_runtime;
--> statement-breakpoint
GRANT UPDATE(payload) ON public.billing_provider_states TO app_runtime;
