CREATE FUNCTION public.pgr_review_actor_allowed(target_org text,target_pgr uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT target_org=current_setting('app.current_org',true) AND (
 -- Existing internal readers without an actor keep their tenant-scoped behavior.
 nullif(current_setting('app.current_actor',true),'') IS NULL OR EXISTS(
  SELECT 1 FROM public.org_memberships m JOIN public.pgr p ON p.org_id=m.org_id
  WHERE m.org_id=target_org AND p.id=target_pgr AND m.user_id=current_setting('app.current_actor',true)
  AND ((m.role IN ('owner','org:admin','collaborator','org:member') AND (m.scoped_company_id IS NULL OR m.scoped_company_id=p.company_id))
   OR (m.role IN ('client','org:client') AND m.scoped_company_id=p.company_id
    AND m.user_id=(SELECT a.reviewer_user_id FROM public.pgr_document_approvals a WHERE a.org_id=target_org AND a.pgr_id=target_pgr AND a.kind='assignment' ORDER BY a.created_at DESC,a.id DESC LIMIT 1)))));
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.pgr_review_actor_allowed(text,uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.pgr_review_actor_allowed(text,uuid) TO app_runtime;
--> statement-breakpoint
CREATE POLICY "pgr_review_decisions_actor_read" ON "pgr_review_decisions" AS RESTRICTIVE FOR SELECT TO "app_runtime" USING (exists(select 1 from public.pgr_review_samples s where s.id="pgr_review_decisions"."sample_id" and s.org_id="pgr_review_decisions"."org_id" and public.pgr_review_actor_allowed(s.org_id,s.pgr_id)));--> statement-breakpoint
CREATE POLICY "pgr_review_samples_actor_read" ON "pgr_review_samples" AS RESTRICTIVE FOR SELECT TO "app_runtime" USING (public.pgr_review_actor_allowed("pgr_review_samples"."org_id","pgr_review_samples"."pgr_id"));--> statement-breakpoint
CREATE POLICY "pgr_document_approval_actor_read" ON "pgr_document_approvals" AS RESTRICTIVE FOR SELECT TO "app_runtime" USING (public.pgr_review_actor_allowed("pgr_document_approvals"."org_id","pgr_document_approvals"."pgr_id"));
