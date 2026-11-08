ALTER TABLE "job_roles" ADD CONSTRAINT "uq_job_roles_id_scope" UNIQUE("id","org_id","company_id");--> statement-breakpoint
ALTER TABLE "medical_risk_absence_declarations" ADD COLUMN "job_role_id" uuid;--> statement-breakpoint
ALTER TABLE "medical_risk_absence_declarations" ADD CONSTRAINT "fk_risk_absence_job_role" FOREIGN KEY ("job_role_id","org_id","company_id") REFERENCES "public"."job_roles"("id","org_id","company_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_risk_absence_scope_job_role" ON "medical_risk_absence_declarations" USING btree ("org_id","source_id","ges_id","job_role_id") WHERE "medical_risk_absence_declarations"."job_role_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_risk_absence_job_role" ON "medical_risk_absence_declarations" USING btree ("job_role_id");--> statement-breakpoint
ALTER TABLE "medical_risk_absence_declarations" ADD CONSTRAINT "ck_risk_absence_job_role_id" CHECK ("medical_risk_absence_declarations"."job_role_id" is null or "medical_risk_absence_declarations"."job_role" <> '');--> statement-breakpoint
CREATE POLICY "risk_absence_job_role_insert" ON "medical_risk_absence_declarations" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK (("medical_risk_absence_declarations"."job_role" = '' and "medical_risk_absence_declarations"."job_role_id" is null) or exists (select 1 from public.ges_job_roles gjr
        join public.job_roles jr on jr.id = gjr.job_role_id and jr.org_id = gjr.org_id
        where gjr.org_id = "medical_risk_absence_declarations"."org_id" and gjr.ges_id = "medical_risk_absence_declarations"."ges_id" and gjr.job_role_id = "medical_risk_absence_declarations"."job_role_id"
          and jr.company_id = "medical_risk_absence_declarations"."company_id" and jr.title = "medical_risk_absence_declarations"."job_role"));--> statement-breakpoint
ALTER POLICY "clinical_record_access_events_insert" ON "clinical_record_access_events" TO app_runtime WITH CHECK ("clinical_record_access_events"."actor_user_id" = current_setting('app.current_actor', true) and exists (select 1 from public.health_exams h
        join lateral public.actor_clinical_medico_ids(h.org_id) c(medico_id) on true
        where h.id = "clinical_record_access_events"."health_exam_id" and h.org_id = "clinical_record_access_events"."org_id" and c.medico_id = "clinical_record_access_events"."medico_id"
          and (h.doctor_id = c.medico_id or exists (select 1 from public.pcmso_coordinator_assignments a
            where a.org_id = h.org_id and a.company_id = h.company_id and a.medico_id = c.medico_id
              and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))))));--> statement-breakpoint
ALTER POLICY "health_exam_clinical_notes_clinician" ON "health_exam_clinical_notes" TO app_runtime USING (exists (select 1 from public.health_exams h
        join lateral public.actor_clinical_medico_ids(h.org_id) c(medico_id) on true
        where h.id = "health_exam_clinical_notes"."health_exam_id" and h.org_id = "health_exam_clinical_notes"."org_id"
          and (h.doctor_id = c.medico_id or exists (select 1 from public.pcmso_coordinator_assignments a
            where a.org_id = h.org_id and a.company_id = h.company_id and a.medico_id = c.medico_id
              and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)))))) WITH CHECK (exists (select 1 from public.health_exams h
        join lateral public.actor_clinical_medico_ids(h.org_id) c(medico_id) on true
        where h.id = "health_exam_clinical_notes"."health_exam_id" and h.org_id = "health_exam_clinical_notes"."org_id"
          and (h.doctor_id = c.medico_id or exists (select 1 from public.pcmso_coordinator_assignments a
            where a.org_id = h.org_id and a.company_id = h.company_id and a.medico_id = c.medico_id
              and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))))));--> statement-breakpoint
ALTER POLICY "health_exam_clinical_notes_insert" ON "health_exam_clinical_notes" TO app_runtime WITH CHECK ("health_exam_clinical_notes"."origin" = 'clinician' and "health_exam_clinical_notes"."recorded_by" = current_setting('app.current_actor', true) and exists (select 1 from public.health_exams h
        join lateral public.actor_clinical_medico_ids(h.org_id) c(medico_id) on true
        where h.id = "health_exam_clinical_notes"."health_exam_id" and h.org_id = "health_exam_clinical_notes"."org_id" and c.medico_id = "health_exam_clinical_notes"."authored_by_medico_id"
          and (h.doctor_id = c.medico_id or exists (select 1 from public.pcmso_coordinator_assignments a
            where a.org_id = h.org_id and a.company_id = h.company_id and a.medico_id = c.medico_id
              and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))))));--> statement-breakpoint
ALTER POLICY "health_exam_work_restrictions_insert" ON "health_exam_work_restrictions" TO app_runtime WITH CHECK ("health_exam_work_restrictions"."recorded_by" = current_setting('app.current_actor', true) and exists (select 1 from public.health_exams h
        join lateral public.actor_clinical_medico_ids(h.org_id) c(medico_id) on true
        where h.id = "health_exam_work_restrictions"."health_exam_id" and h.org_id = "health_exam_work_restrictions"."org_id" and c.medico_id = "health_exam_work_restrictions"."authored_by_medico_id"
          and (h.doctor_id = c.medico_id or exists (select 1 from public.pcmso_coordinator_assignments a
            where a.org_id = h.org_id and a.company_id = h.company_id and a.medico_id = c.medico_id
              and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))))));--> statement-breakpoint
ALTER POLICY "absence_clinical_access_insert" ON "absence_clinical_access_events" TO app_runtime WITH CHECK ("absence_clinical_access_events"."actor_user_id" = current_setting('app.current_actor', true) and exists (select 1 from public.pcmso_coordinator_assignments a
        where a.org_id = "absence_clinical_access_events"."org_id" and a.company_id = "absence_clinical_access_events"."company_id" and a.medico_id = "absence_clinical_access_events"."medico_id"
          and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))
          and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))));--> statement-breakpoint
ALTER POLICY "absence_clinical_notes_coordinator" ON "employee_absence_clinical_notes" TO app_runtime USING (exists (select 1 from public.pcmso_coordinator_assignments a
        where a.org_id = "employee_absence_clinical_notes"."org_id" and a.company_id = "employee_absence_clinical_notes"."company_id"
          and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))
          and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id)))) WITH CHECK (exists (select 1 from public.pcmso_coordinator_assignments a
        where a.org_id = "employee_absence_clinical_notes"."org_id" and a.company_id = "employee_absence_clinical_notes"."company_id"
          and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))
          and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))));--> statement-breakpoint
ALTER POLICY "absence_clinical_notes_insert" ON "employee_absence_clinical_notes" TO app_runtime WITH CHECK ("employee_absence_clinical_notes"."recorded_by" = current_setting('app.current_actor', true) and exists (select 1 from public.pcmso_coordinator_assignments a
        where a.org_id = "employee_absence_clinical_notes"."org_id" and a.company_id = "employee_absence_clinical_notes"."company_id" and a.medico_id = "employee_absence_clinical_notes"."authored_by_medico_id"
          and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))
          and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))));--> statement-breakpoint
ALTER POLICY "exam_plan_items_insert" ON "medical_exam_plan_items" TO app_runtime WITH CHECK (exists (select 1 from public.medical_exam_plans p where p.id = "medical_exam_plan_items"."plan_id" and p.org_id = "medical_exam_plan_items"."org_id" and p.status = 'draft') and "medical_exam_plan_items"."created_by" = current_setting('app.current_actor', true) and ("medical_exam_plan_items"."origin" = 'suggested' or exists (select 1 from public.pcmso_coordinator_assignments a
    where a.org_id = "medical_exam_plan_items"."org_id" and a.company_id = "medical_exam_plan_items"."company_id"
      and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))
      and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id)))));--> statement-breakpoint
ALTER POLICY "exam_plan_items_coordinator_update" ON "medical_exam_plan_items" TO app_runtime USING (exists (select 1 from public.medical_exam_plans p where p.id = "medical_exam_plan_items"."plan_id" and p.org_id = "medical_exam_plan_items"."org_id" and p.status = 'draft') and exists (select 1 from public.pcmso_coordinator_assignments a
    where a.org_id = "medical_exam_plan_items"."org_id" and a.company_id = "medical_exam_plan_items"."company_id"
      and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))
      and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id)))) WITH CHECK (exists (select 1 from public.medical_exam_plans p where p.id = "medical_exam_plan_items"."plan_id" and p.org_id = "medical_exam_plan_items"."org_id" and p.status = 'draft') and exists (select 1 from public.pcmso_coordinator_assignments a
    where a.org_id = "medical_exam_plan_items"."org_id" and a.company_id = "medical_exam_plan_items"."company_id"
      and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))
      and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))) and "medical_exam_plan_items"."updated_by" = current_setting('app.current_actor', true));--> statement-breakpoint
ALTER POLICY "exam_plans_coordinator_transition" ON "medical_exam_plans" TO app_runtime USING ("medical_exam_plans"."status" in ('draft','approved') and exists (select 1 from public.pcmso_coordinator_assignments a
    where a.org_id = "medical_exam_plans"."org_id" and a.company_id = "medical_exam_plans"."company_id"
      and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))
      and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id)))) WITH CHECK (("medical_exam_plans"."status" = 'approved' and "medical_exam_plans"."approved_by_user" = current_setting('app.current_actor', true)) or "medical_exam_plans"."status" = 'superseded');--> statement-breakpoint
ALTER POLICY "report_events_insert" ON "pcmso_analytical_report_events" TO app_runtime WITH CHECK ("pcmso_analytical_report_events"."recorded_by" = current_setting('app.current_actor', true)
        and exists (select 1 from public.pcmso_analytical_reports r where r.id = "pcmso_analytical_report_events"."report_id" and r.org_id = "pcmso_analytical_report_events"."org_id"
          and r.company_id = "pcmso_analytical_report_events"."company_id" and r.content_sha256 = "pcmso_analytical_report_events"."report_sha256"
          and ("pcmso_analytical_report_events"."kind" = 'voided' or not exists (select 1 from public.pcmso_analytical_reports n
            where n.org_id = r.org_id and n.company_id = r.company_id and n.version > r.version)))
        and (
          ("pcmso_analytical_report_events"."kind" = 'finalized' and exists (select 1 from public.pcmso_analytical_reports r
            join public.pcmso_coordinator_assignments a on a.org_id = r.org_id and a.company_id = r.company_id
              and a.medico_id = r.authored_by_medico_id and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))
            where r.id = "pcmso_analytical_report_events"."report_id" and r.org_id = "pcmso_analytical_report_events"."org_id"
              and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))))
          or ("pcmso_analytical_report_events"."kind" <> 'finalized' and exists (select 1 from public.org_memberships om where om.org_id = "pcmso_analytical_report_events"."org_id"
            and om.user_id = current_setting('app.current_actor', true) and om.role in ('owner','collaborator','org:admin','org:member')))
        ));--> statement-breakpoint
ALTER POLICY "pcmso_analytical_reports_insert" ON "pcmso_analytical_reports" TO app_runtime WITH CHECK ("pcmso_analytical_reports"."generated_by" = current_setting('app.current_actor', true) and exists (select 1 from public.pcmso_coordinator_assignments a
        where a.org_id = "pcmso_analytical_reports"."org_id" and a.company_id = "pcmso_analytical_reports"."company_id"
          and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))
          and a.medico_id = "pcmso_analytical_reports"."authored_by_medico_id"
          and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))));--> statement-breakpoint
ALTER POLICY "pcmso_interpretation_criteria_insert" ON "pcmso_interpretation_criteria" TO app_runtime WITH CHECK ("pcmso_interpretation_criteria"."authored_by_user" = current_setting('app.current_actor', true) and exists (select 1 from public.pcmso_coordinator_assignments a
        where a.org_id = "pcmso_interpretation_criteria"."org_id" and a.company_id = "pcmso_interpretation_criteria"."company_id"
          and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))
          and a.medico_id = "pcmso_interpretation_criteria"."authored_by_medico_id"
          and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))));--> statement-breakpoint
ALTER POLICY "pcmso_signed_documents_insert" ON "pcmso_signed_documents" TO app_runtime WITH CHECK ("pcmso_signed_documents"."registered_by" = current_setting('app.current_actor', true)
        and exists (select 1 from public.pcmso_documents d where d.id = "pcmso_signed_documents"."preview_document_id" and d.org_id = "pcmso_signed_documents"."org_id"
          and d.company_id = "pcmso_signed_documents"."company_id" and d.content_sha256 = "pcmso_signed_documents"."preview_sha256" and d.exam_plan_id = "pcmso_signed_documents"."exam_plan_id"
          and d.risk_basis_digest is not null and d.risk_basis_digest = public.medical_risk_basis_digest(d.org_id, d.company_id)
          and jsonb_typeof(d.content->'riskBasis'->'sources') = 'array' and jsonb_array_length(d.content->'riskBasis'->'sources') > 0
          and not exists (select 1 from jsonb_array_elements(d.content->'riskBasis'->'sources') sx where not exists (select 1 from public.medical_risk_sources ms
            where ms.id::text = sx->>'id' and ms.org_id = "pcmso_signed_documents"."org_id" and ms.company_id = "pcmso_signed_documents"."company_id" and ms.version = sx->>'version' and not exists (select 1 from public.medical_risk_sources nx where nx.org_id = ms.org_id and nx.company_id = ms.company_id and nx.supersedes_source_id = ms.id)))
          and not exists (select 1 from public.medical_risk_sources ms where ms.org_id = "pcmso_signed_documents"."org_id" and ms.company_id = "pcmso_signed_documents"."company_id" and not exists (select 1 from public.medical_risk_sources nx where nx.org_id = ms.org_id and nx.company_id = ms.company_id and nx.supersedes_source_id = ms.id)
            and not exists (select 1 from jsonb_array_elements(d.content->'riskBasis'->'sources') sx where sx->>'id' = ms.id::text)))
        and exists (select 1 from public.medical_exam_plans p where p.id = "pcmso_signed_documents"."exam_plan_id" and p.org_id = "pcmso_signed_documents"."org_id"
          and p.company_id = "pcmso_signed_documents"."company_id" and p.status = 'approved'
          and jsonb_typeof(p.based_on->'sources') = 'array' and jsonb_array_length(p.based_on->'sources') > 0
          and not exists (select 1 from jsonb_array_elements(p.based_on->'sources') sx where not exists (select 1 from public.medical_risk_sources ms
            where ms.id::text = sx->>'id' and ms.org_id = "pcmso_signed_documents"."org_id" and ms.company_id = "pcmso_signed_documents"."company_id" and ms.version = sx->>'version' and not exists (select 1 from public.medical_risk_sources nx where nx.org_id = ms.org_id and nx.company_id = ms.company_id and nx.supersedes_source_id = ms.id)))
          and not exists (select 1 from public.medical_risk_sources ms where ms.org_id = "pcmso_signed_documents"."org_id" and ms.company_id = "pcmso_signed_documents"."company_id" and not exists (select 1 from public.medical_risk_sources nx where nx.org_id = ms.org_id and nx.company_id = ms.company_id and nx.supersedes_source_id = ms.id)
            and not exists (select 1 from jsonb_array_elements(p.based_on->'sources') sx where sx->>'id' = ms.id::text)))
        and exists (select 1 from public.pcmso_coordinator_assignments a join public.medicos m on m.id = a.medico_id and m.org_id = a.org_id
          where a.org_id = "pcmso_signed_documents"."org_id" and a.company_id = "pcmso_signed_documents"."company_id"
            and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))
            and m.crm = "pcmso_signed_documents"."signer_registration" and m.registration_uf = "pcmso_signed_documents"."signer_uf"
            and ("pcmso_signed_documents"."origin" <> 'coordinator' or a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))))
        and ("pcmso_signed_documents"."origin" <> 'office_received' or exists (select 1 from public.org_memberships om where om.org_id = "pcmso_signed_documents"."org_id"
          and om.user_id = current_setting('app.current_actor', true) and om.role in ('owner','collaborator','org:admin','org:member'))));--> statement-breakpoint
-- Etapa B (NOB-112/NOB-110/NOB-156): declaração de inexistência de riscos presa ao id da função.
-- SQL que o drizzle-kit não emite. Acrescentar AO FINAL da 0080 gerada (depois do ADD COLUMN
-- "job_role_id", do UNIQUE "uq_job_roles_id_scope" e do ADD CONSTRAINT "fk_risk_absence_job_role").
-- Roda como owner (conexão direta): RLS não se aplica e o REVOKE UPDATE do app_runtime não pesa.
--
-- 1) ON DELETE SET NULL só na coluna da função: o "set null" do schema zeraria também org_id e
--    company_id (NOT NULL) e impediria excluir a função. Excluir a função zera só job_role_id;
--    título, autor, data e justificativa ficam (PostgreSQL >= 15).
ALTER TABLE "medical_risk_absence_declarations" DROP CONSTRAINT "fk_risk_absence_job_role";--> statement-breakpoint
ALTER TABLE "medical_risk_absence_declarations" ADD CONSTRAINT "fk_risk_absence_job_role" FOREIGN KEY ("job_role_id","org_id","company_id") REFERENCES "public"."job_roles"("id","org_id","company_id") ON DELETE SET NULL ("job_role_id") ON UPDATE no action;--> statement-breakpoint
-- 2) backfill:risk-absence-job-role-id — vincula declarações antigas (só título) à função
--    cadastrada SOMENTE quando inequívoco: exatamente uma função da mesma empresa e tenant com
--    exatamente aquele título (sem ajuste de caixa, acento ou espaço) E vinculada ao GES da
--    declaração em ges_job_roles. Ambíguas ou sem correspondência ficam com job_role_id nulo e
--    não valem no ASO (regularização: o profissional autorizado declara de novo). Só preenche
--    job_role_id; nada é apagado nem reescrito. Idempotente (só linhas com job_role_id nulo).
UPDATE "medical_risk_absence_declarations" AS d
SET "job_role_id" = c.job_role_id
FROM (
  SELECT d2.id AS declaration_id,
    min(jr.id::text)::uuid AS job_role_id,
    count(*) AS same_title,
    bool_and(EXISTS (
      SELECT 1 FROM "ges_job_roles" gjr
      WHERE gjr.org_id = d2.org_id AND gjr.ges_id = d2.ges_id AND gjr.job_role_id = jr.id
    )) AS linked
  FROM "medical_risk_absence_declarations" d2
  JOIN "job_roles" jr
    ON jr.org_id = d2.org_id AND jr.company_id = d2.company_id AND jr.title = d2.job_role
  WHERE d2.job_role_id IS NULL AND d2.job_role <> ''
  GROUP BY d2.id
) AS c
WHERE d.id = c.declaration_id
  AND c.same_title = 1
  AND c.linked
  AND d.job_role_id IS NULL;
