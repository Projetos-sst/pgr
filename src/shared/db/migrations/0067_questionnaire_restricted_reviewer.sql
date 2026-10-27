-- Independent document review is available on Free without granting an office-staff role.
CREATE FUNCTION public.add_restricted_pgr_reviewer(target_org text,target_pgr uuid,target_user text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE target_company uuid; existing_role text; existing_company uuid;
BEGIN
 IF target_org IS DISTINCT FROM current_setting('app.current_org',true)
 OR NOT EXISTS(SELECT 1 FROM public.org_memberships m WHERE m.org_id=target_org AND m.user_id=current_setting('app.current_actor',true) AND m.role IN ('owner','org:admin')) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Somente o administrador pode conceder acesso de revisão.';
 END IF;
 SELECT p.company_id INTO target_company FROM public.pgr p WHERE p.org_id=target_org AND p.id=target_pgr
 AND p.created_by IS DISTINCT FROM target_user;
 IF target_company IS NULL OR target_user=current_setting('app.current_actor',true) OR NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=target_user) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Conta ou documento indisponível para revisão independente.';
 END IF;
 INSERT INTO public.org_memberships(org_id,user_id,role,scoped_company_id) VALUES(target_org,target_user,'client',target_company) ON CONFLICT(org_id,user_id) DO NOTHING;
 SELECT m.role,m.scoped_company_id INTO existing_role,existing_company FROM public.org_memberships m WHERE m.org_id=target_org AND m.user_id=target_user;
 IF NOT ((existing_role IN ('owner','org:admin','collaborator','org:member') AND existing_company IS NULL)
 OR (existing_role IN ('client','org:client') AND existing_company=target_company)) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='A conta já tem um vínculo restrito diferente. O vínculo existente foi preservado.';
 END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.add_restricted_pgr_reviewer(text,uuid,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.add_restricted_pgr_reviewer(text,uuid,text) TO app_runtime;
--> statement-breakpoint
CREATE FUNCTION public.revoke_restricted_pgr_reviewer(target_org text,target_pgr uuid,target_user text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE target_company uuid;
BEGIN
 IF target_org IS DISTINCT FROM current_setting('app.current_org',true)
 OR NOT EXISTS(SELECT 1 FROM public.org_memberships m WHERE m.org_id=target_org AND m.user_id=current_setting('app.current_actor',true) AND m.role IN ('owner','org:admin')) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Somente o administrador pode revogar acesso de revisão.';
 END IF;
 SELECT p.company_id INTO target_company FROM public.pgr p WHERE p.org_id=target_org AND p.id=target_pgr FOR UPDATE;
 IF target_company IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Documento indisponível.'; END IF;
 DELETE FROM public.org_memberships m WHERE m.org_id=target_org AND m.user_id=target_user AND m.role IN ('client','org:client') AND m.scoped_company_id=target_company;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='A conta não possui este acesso restrito. Papéis da equipe foram preservados.'; END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.revoke_restricted_pgr_reviewer(text,uuid,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.revoke_restricted_pgr_reviewer(text,uuid,text) TO app_runtime;
--> statement-breakpoint
ALTER POLICY "pgr_document_approval_insert" ON "pgr_document_approvals" TO app_runtime WITH CHECK (
    "pgr_document_approvals"."org_id"=current_setting('app.current_org',true) and "pgr_document_approvals"."actor"=current_setting('app.current_actor',true)
    and exists(select 1 from public.pgr p where p.id="pgr_document_approvals"."pgr_id" and p.org_id="pgr_document_approvals"."org_id" and (p.created_by is null or p.created_by="pgr_document_approvals"."author_user_id"))
    and exists(select 1 from public.org_memberships m where m.org_id="pgr_document_approvals"."org_id" and m.user_id="pgr_document_approvals"."reviewer_user_id" and ((m.role in ('owner','org:admin','collaborator','org:member') and m.scoped_company_id is null) or (m.role in ('client','org:client') and m.scoped_company_id=(select p.company_id from public.pgr p where p.id="pgr_document_approvals"."pgr_id" and p.org_id="pgr_document_approvals"."org_id"))))
    and (("pgr_document_approvals"."kind"='assignment' and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))) or ("pgr_document_approvals"."kind"='decision' and "pgr_document_approvals"."actor"="pgr_document_approvals"."reviewer_user_id"
      and "pgr_document_approvals"."assignment_id"=(select a.id from public.pgr_document_approvals a where a.org_id="pgr_document_approvals"."org_id" and a.pgr_id="pgr_document_approvals"."pgr_id" and a.kind='assignment' order by a.created_at desc,a.id desc limit 1)
      and exists(select 1 from public.pgr_document_approvals a where a.id="pgr_document_approvals"."assignment_id" and a.org_id="pgr_document_approvals"."org_id" and a.pgr_id="pgr_document_approvals"."pgr_id" and a.kind='assignment' and a.author_user_id="pgr_document_approvals"."author_user_id" and a.reviewer_user_id="pgr_document_approvals"."reviewer_user_id" and a.reviewer="pgr_document_approvals"."reviewer")
      and exists(select 1 from public.pgr_review_samples s where s.id="pgr_document_approvals"."sample_id" and s.org_id="pgr_document_approvals"."org_id" and s.pgr_id="pgr_document_approvals"."pgr_id" and s.created_by<>"pgr_document_approvals"."actor" and s.snapshot_sha256="pgr_document_approvals"."source_sha256" and s.template_sha256="pgr_document_approvals"."template_sha256"))));
