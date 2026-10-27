CREATE TABLE "billing_trial_claims" (
	"cnpj_hash" text PRIMARY KEY NOT NULL,
	"trial_id" uuid NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_trial_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_trial_claims" ADD CONSTRAINT "billing_trial_claims_trial_id_billing_trials_id_fk" FOREIGN KEY ("trial_id") REFERENCES "public"."billing_trials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "billing_trial_claims_private" ON "billing_trial_claims" AS PERMISSIVE FOR ALL TO "app_runtime" USING (false) WITH CHECK (false);
--> statement-breakpoint
-- Preserve existing trials and reserve their original normalized identity. Never expose the ledger.
INSERT INTO public.billing_trial_claims(cnpj_hash,trial_id,claimed_at)
SELECT DISTINCT ON (upper(regexp_replace(c.cnpj,'[^a-zA-Z0-9]','','g')))
 encode(sha256(convert_to(upper(regexp_replace(c.cnpj,'[^a-zA-Z0-9]','','g')),'UTF8')),'hex'),t.id,t.started_at
FROM public.billing_trials t JOIN public.companies c ON c.id=t.company_id AND c.org_id=t.org_id
WHERE upper(regexp_replace(c.cnpj,'[^a-zA-Z0-9]','','g')) ~ '^[A-Z0-9]{12}[0-9]{2}$'
ORDER BY upper(regexp_replace(c.cnpj,'[^a-zA-Z0-9]','','g')),t.started_at,t.id
ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE FUNCTION public.claim_billing_trial(target_org text,target_company uuid,target_trial uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE identity_hash text;
BEGIN
 IF target_org IS DISTINCT FROM current_setting('app.current_org',true)
 OR current_setting('app.billing_simulation',true) IS DISTINCT FROM 'true'
 OR NOT EXISTS(SELECT 1 FROM public.org_memberships m WHERE m.org_id=target_org AND m.user_id=current_setting('app.current_actor',true) AND m.role IN ('owner','org:admin')) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Operação não autorizada.';
 END IF;
 SELECT encode(sha256(convert_to(upper(regexp_replace(c.cnpj,'[^a-zA-Z0-9]','','g')),'UTF8')),'hex') INTO identity_hash
 FROM public.companies c JOIN public.billing_trials t ON t.company_id=c.id AND t.org_id=c.org_id
 WHERE c.org_id=target_org AND c.id=target_company AND t.id=target_trial
 AND upper(regexp_replace(c.cnpj,'[^a-zA-Z0-9]','','g')) ~ '^[A-Z0-9]{12}[0-9]{2}$';
 IF identity_hash IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Empresa ou teste indisponível.'; END IF;
 INSERT INTO public.billing_trial_claims(cnpj_hash,trial_id) VALUES(identity_hash,target_trial) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='Teste grátis indisponível para este CNPJ.',CONSTRAINT='billing_trial_claims_pkey'; END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.claim_billing_trial(text,uuid,uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.claim_billing_trial(text,uuid,uuid) TO app_runtime;
--> statement-breakpoint
CREATE FUNCTION public.billing_trial_identity_matches(target_org text,target_company uuid,target_trial uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT target_org=current_setting('app.current_org',true) AND EXISTS(
 SELECT 1 FROM public.billing_trial_claims r JOIN public.billing_trials t ON t.id=r.trial_id
 JOIN public.companies c ON c.id=t.company_id AND c.org_id=t.org_id
 WHERE t.org_id=target_org AND t.company_id=target_company AND t.id=target_trial
 AND r.cnpj_hash=encode(sha256(convert_to(upper(regexp_replace(c.cnpj,'[^a-zA-Z0-9]','','g')),'UTF8')),'hex'));
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.billing_trial_identity_matches(text,uuid,uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.billing_trial_identity_matches(text,uuid,uuid) TO app_runtime;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.billing_module_allowed(target_org text,target_company uuid,target_module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT current_setting('app.billing_simulation',true)='true'
 AND target_org=current_setting('app.current_org',true) AND target_module IN ('pgr','medicine')
 AND NOT EXISTS(SELECT 1 FROM public.company_modules m WHERE m.org_id=target_org AND m.company_id=target_company AND m.module=target_module AND NOT m.enabled)
 AND (public.billing_paid_product(target_org,target_company,target_module)
 OR EXISTS(SELECT 1 FROM public.billing_trials t WHERE t.org_id=target_org AND t.company_id=target_company AND t.ends_at>now()
 AND public.billing_trial_identity_matches(target_org,target_company,t.id)));
$$;
