-- NOB-158: papel do operador de verificação, separado do app_runtime. NOLOGIN: a conta de login
-- (membro deste papel) é provisionada pela infraestrutura, fora das migrations.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'identity_verifier') THEN
    CREATE ROLE identity_verifier NOLOGIN;
  END IF;
END $$;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO identity_verifier;--> statement-breakpoint
CREATE TABLE "identity_verifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"designated_by" text NOT NULL,
	"designated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" text,
	"revoke_reason" text,
	CONSTRAINT "ck_identity_verifiers_revocation" CHECK (("identity_verifiers"."revoked_at" is null) = ("identity_verifiers"."revoked_by" is null) and ("identity_verifiers"."revoked_at" is null) = ("identity_verifiers"."revoke_reason" is null)),
	CONSTRAINT "ck_identity_verifiers_not_self" CHECK ("identity_verifiers"."designated_by" <> "identity_verifiers"."user_id")
);--> statement-breakpoint
ALTER TABLE "identity_verifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "medico_link_reconfirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"link_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"statement" text NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "medico_link_reconfirmations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "professional_identity_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"medico_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "professional_identity_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "professional_identity_review_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"kind" text NOT NULL,
	"request_id" uuid,
	"verification_id" uuid,
	"reason" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_identity_reviews_kind" CHECK (("professional_identity_review_events"."kind" = 'rejected' and "professional_identity_review_events"."request_id" is not null and "professional_identity_review_events"."verification_id" is null) or ("professional_identity_review_events"."kind" = 'revoked' and "professional_identity_review_events"."verification_id" is not null and "professional_identity_review_events"."request_id" is null)),
	CONSTRAINT "ck_identity_reviews_reason" CHECK (char_length(btrim("professional_identity_review_events"."reason")) >= 10)
);--> statement-breakpoint
ALTER TABLE "professional_identity_review_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "professional_identity_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"medico_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"crm" text NOT NULL,
	"registration_uf" text NOT NULL,
	"method" text NOT NULL,
	"checklist" jsonb NOT NULL,
	"registry_source" text NOT NULL,
	"evidence_ref" text,
	"verified_by" text NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ck_identity_verifications_method" CHECK ("professional_identity_verifications"."method" in ('in_person','live_video')),
	CONSTRAINT "ck_identity_verifications_uf" CHECK ("professional_identity_verifications"."registration_uf" ~ '^[A-Z]{2}$'),
	CONSTRAINT "ck_identity_verifications_checklist" CHECK ("professional_identity_verifications"."checklist" @> '{"identityDocument":true,"professionalDocument":true,"registryStatus":true,"personMatches":true,"accountControl":true}'::jsonb),
	CONSTRAINT "ck_identity_verifications_validity" CHECK ("professional_identity_verifications"."expires_at" > "professional_identity_verifications"."verified_at" and "professional_identity_verifications"."expires_at" <= "professional_identity_verifications"."verified_at" + interval '36 months'),
	CONSTRAINT "ck_identity_verifications_independent" CHECK ("professional_identity_verifications"."verified_by" <> "professional_identity_verifications"."user_id"),
	CONSTRAINT "ck_identity_verifications_source" CHECK (btrim("professional_identity_verifications"."registry_source") <> '')
);--> statement-breakpoint
ALTER TABLE "professional_identity_verifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_medico_user_links_id_org" ON "medico_user_links" USING btree ("id","org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_identity_verifiers_active" ON "identity_verifiers" USING btree ("user_id") WHERE "identity_verifiers"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_link_reconfirmations_link" ON "medico_link_reconfirmations" USING btree ("link_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_identity_requests_id_org" ON "professional_identity_requests" USING btree ("id","org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_identity_reviews_rejected" ON "professional_identity_review_events" USING btree ("request_id") WHERE "professional_identity_review_events"."kind" = 'rejected';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_identity_reviews_revoked" ON "professional_identity_review_events" USING btree ("verification_id") WHERE "professional_identity_review_events"."kind" = 'revoked';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_identity_verifications_request" ON "professional_identity_verifications" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_identity_verifications_id_org" ON "professional_identity_verifications" USING btree ("id","org_id");--> statement-breakpoint
ALTER TABLE "medico_link_reconfirmations" ADD CONSTRAINT "medico_link_reconfirmations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medico_link_reconfirmations" ADD CONSTRAINT "fk_link_reconfirmations_link" FOREIGN KEY ("link_id","org_id") REFERENCES "public"."medico_user_links"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_identity_requests" ADD CONSTRAINT "professional_identity_requests_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_identity_requests" ADD CONSTRAINT "fk_identity_requests_medico" FOREIGN KEY ("medico_id","org_id") REFERENCES "public"."medicos"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_identity_review_events" ADD CONSTRAINT "professional_identity_review_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_identity_review_events" ADD CONSTRAINT "fk_identity_reviews_request" FOREIGN KEY ("request_id","org_id") REFERENCES "public"."professional_identity_requests"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_identity_review_events" ADD CONSTRAINT "fk_identity_reviews_verification" FOREIGN KEY ("verification_id","org_id") REFERENCES "public"."professional_identity_verifications"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_identity_verifications" ADD CONSTRAINT "professional_identity_verifications_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_identity_verifications" ADD CONSTRAINT "fk_identity_verifications_request" FOREIGN KEY ("request_id","org_id") REFERENCES "public"."professional_identity_requests"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_identity_requests_scope" ON "professional_identity_requests" USING btree ("org_id","medico_id","user_id","requested_at");--> statement-breakpoint
CREATE INDEX "idx_identity_verifications_scope" ON "professional_identity_verifications" USING btree ("org_id","medico_id","user_id","verified_at");--> statement-breakpoint
-- NOB-158/159: predicado ÚNICO do acesso clínico. Profissional (medico_id) da conta da sessão no
-- escritório, com vínculo ativo, médico ativo, associação viva, vínculo por convite ou legado
-- reconfirmado pela própria conta, e identidade verificada válida (não revogada, não vencida, CRM/UF
-- iguais ao cadastro atual). SECURITY INVOKER: a RLS do chamador continua valendo.
CREATE OR REPLACE FUNCTION public.actor_clinical_medico_ids(p_org text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
  SELECT l.medico_id
    FROM public.medico_user_links l
    JOIN public.medicos m ON m.id = l.medico_id AND m.org_id = l.org_id
     AND m.status = 'active' AND m.profession = 'physician'
    JOIN public.org_memberships om ON om.org_id = l.org_id AND om.user_id = l.user_id
   WHERE l.org_id = p_org
     AND l.user_id = current_setting('app.current_actor', true)
     AND l.revoked_at IS NULL
     AND (l.invitation_id IS NOT NULL OR EXISTS (
           SELECT 1 FROM public.medico_link_reconfirmations rc
            WHERE rc.org_id = l.org_id AND rc.link_id = l.id AND rc.user_id = l.user_id))
     AND EXISTS (
           SELECT 1 FROM public.professional_identity_verifications v
            WHERE v.org_id = l.org_id AND v.medico_id = l.medico_id AND v.user_id = l.user_id
              AND v.crm = m.crm AND v.registration_uf = m.registration_uf AND v.expires_at > now()
              AND NOT EXISTS (
                SELECT 1 FROM public.professional_identity_review_events r
                 WHERE r.org_id = v.org_id AND r.verification_id = v.id AND r.kind = 'revoked'))
$fn$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.actor_clinical_medico_ids(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.actor_clinical_medico_ids(text) TO app_runtime;--> statement-breakpoint
CREATE POLICY "medicos_identity_verifier_read" ON "medicos" AS PERMISSIVE FOR SELECT TO "identity_verifier" USING (true);--> statement-breakpoint
CREATE POLICY "org_memberships_identity_verifier_read" ON "org_memberships" AS PERMISSIVE FOR SELECT TO "identity_verifier" USING (true);--> statement-breakpoint
CREATE POLICY "orgs_identity_verifier_read" ON "orgs" AS PERMISSIVE FOR SELECT TO "identity_verifier" USING (true);--> statement-breakpoint
CREATE POLICY "identity_verifiers_verifier_read" ON "identity_verifiers" AS PERMISSIVE FOR SELECT TO "identity_verifier" USING (true);--> statement-breakpoint
CREATE POLICY "link_reconfirmations_isolation" ON "medico_link_reconfirmations" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "link_reconfirmations_own_insert" ON "medico_link_reconfirmations" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("medico_link_reconfirmations"."user_id" = current_setting('app.current_actor', true) and exists (select 1 from public.medico_user_links l
        where l.id = "medico_link_reconfirmations"."link_id" and l.org_id = "medico_link_reconfirmations"."org_id" and l.user_id = current_setting('app.current_actor', true) and l.revoked_at is null and l.invitation_id is null));--> statement-breakpoint
CREATE POLICY "identity_requests_isolation" ON "professional_identity_requests" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "identity_requests_own_insert" ON "professional_identity_requests" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("professional_identity_requests"."user_id" = current_setting('app.current_actor', true) and (
        exists (select 1 from public.medico_user_links l where l.org_id = "professional_identity_requests"."org_id" and l.medico_id = "professional_identity_requests"."medico_id" and l.user_id = current_setting('app.current_actor', true) and l.revoked_at is null)
        or exists (select 1 from public.medico_link_invitations i where i.org_id = "professional_identity_requests"."org_id" and i.medico_id = "professional_identity_requests"."medico_id" and i.user_id = current_setting('app.current_actor', true) and i.expires_at > now()
          and exists (select 1 from public.medico_link_invitation_events a where a.org_id = i.org_id and a.invitation_id = i.id and a.kind = 'accepted' and a.actor_user_id = i.user_id)
          and not exists (select 1 from public.medico_link_invitation_events c where c.org_id = i.org_id and c.invitation_id = i.id and c.kind in ('declined','cancelled')))));--> statement-breakpoint
CREATE POLICY "identity_requests_verifier_read" ON "professional_identity_requests" AS PERMISSIVE FOR SELECT TO "identity_verifier" USING (true);--> statement-breakpoint
CREATE POLICY "identity_reviews_isolation" ON "professional_identity_review_events" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "identity_reviews_verifier_read" ON "professional_identity_review_events" AS PERMISSIVE FOR SELECT TO "identity_verifier" USING (true);--> statement-breakpoint
CREATE POLICY "identity_reviews_verifier_insert" ON "professional_identity_review_events" AS PERMISSIVE FOR INSERT TO "identity_verifier" WITH CHECK ("professional_identity_review_events"."actor_user_id" = current_setting('app.current_actor', true) and exists (select 1 from public.identity_verifiers iv where iv.user_id = current_setting('app.current_actor', true) and iv.revoked_at is null)
        and not exists (select 1 from public.org_memberships om where om.org_id = "professional_identity_review_events"."org_id" and om.user_id = current_setting('app.current_actor', true)));--> statement-breakpoint
CREATE POLICY "identity_verifications_isolation" ON "professional_identity_verifications" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "identity_verifications_verifier_read" ON "professional_identity_verifications" AS PERMISSIVE FOR SELECT TO "identity_verifier" USING (true);--> statement-breakpoint
CREATE POLICY "identity_verifications_verifier_insert" ON "professional_identity_verifications" AS PERMISSIVE FOR INSERT TO "identity_verifier" WITH CHECK ("professional_identity_verifications"."verified_by" = current_setting('app.current_actor', true) and exists (select 1 from public.identity_verifiers iv where iv.user_id = current_setting('app.current_actor', true) and iv.revoked_at is null)
        and "professional_identity_verifications"."verified_by" <> "professional_identity_verifications"."user_id"
        and not exists (select 1 from public.org_memberships om where om.org_id = "professional_identity_verifications"."org_id" and om.user_id = current_setting('app.current_actor', true))
        and exists (select 1 from public.professional_identity_requests rq where rq.id = "professional_identity_verifications"."request_id" and rq.org_id = "professional_identity_verifications"."org_id"
          and rq.medico_id = "professional_identity_verifications"."medico_id" and rq.user_id = "professional_identity_verifications"."user_id"
          and not exists (select 1 from public.professional_identity_review_events r where r.org_id = rq.org_id and r.request_id = rq.id and r.kind = 'rejected'))
        and exists (select 1 from public.medicos m where m.id = "professional_identity_verifications"."medico_id" and m.org_id = "professional_identity_verifications"."org_id"
          and m.crm = "professional_identity_verifications"."crm" and m.registration_uf = "professional_identity_verifications"."registration_uf" and m.status = 'active' and m.profession = 'physician'));--> statement-breakpoint
ALTER POLICY "aso_examiner_conclusions_insert" ON "aso_examiner_conclusions" TO app_runtime WITH CHECK ("aso_examiner_conclusions"."confirmed_by" = current_setting('app.current_actor', true) and exists (select 1 from public.health_exams h
        where h.id = "aso_examiner_conclusions"."health_exam_id" and h.org_id = "aso_examiner_conclusions"."org_id" and h.company_id = "aso_examiner_conclusions"."company_id"
          and h.doctor_id = "aso_examiner_conclusions"."examiner_medico_id" and h.aptitude::text = "aso_examiner_conclusions"."recorded_aptitude"
          and h.doctor_id in (select public.actor_clinical_medico_ids(h.org_id))));--> statement-breakpoint
ALTER POLICY "clinical_record_access_events_insert" ON "clinical_record_access_events" TO app_runtime WITH CHECK ("clinical_record_access_events"."actor_user_id" = current_setting('app.current_actor', true) and exists (select 1 from public.health_exams h
        join lateral public.actor_clinical_medico_ids(h.org_id) c(medico_id) on true
        where h.id = "clinical_record_access_events"."health_exam_id" and h.org_id = "clinical_record_access_events"."org_id" and c.medico_id = "clinical_record_access_events"."medico_id"
          and (h.doctor_id = c.medico_id or exists (select 1 from public.pcmso_coordinator_assignments a
            where a.org_id = h.org_id and a.company_id = h.company_id and a.medico_id = c.medico_id and a.ends_on is null))));--> statement-breakpoint
ALTER POLICY "health_exam_clinical_notes_clinician" ON "health_exam_clinical_notes" TO app_runtime USING (exists (select 1 from public.health_exams h
        join lateral public.actor_clinical_medico_ids(h.org_id) c(medico_id) on true
        where h.id = "health_exam_clinical_notes"."health_exam_id" and h.org_id = "health_exam_clinical_notes"."org_id"
          and (h.doctor_id = c.medico_id or exists (select 1 from public.pcmso_coordinator_assignments a
            where a.org_id = h.org_id and a.company_id = h.company_id and a.medico_id = c.medico_id and a.ends_on is null)))) WITH CHECK (exists (select 1 from public.health_exams h
        join lateral public.actor_clinical_medico_ids(h.org_id) c(medico_id) on true
        where h.id = "health_exam_clinical_notes"."health_exam_id" and h.org_id = "health_exam_clinical_notes"."org_id"
          and (h.doctor_id = c.medico_id or exists (select 1 from public.pcmso_coordinator_assignments a
            where a.org_id = h.org_id and a.company_id = h.company_id and a.medico_id = c.medico_id and a.ends_on is null))));--> statement-breakpoint
ALTER POLICY "health_exam_clinical_notes_insert" ON "health_exam_clinical_notes" TO app_runtime WITH CHECK ("health_exam_clinical_notes"."origin" = 'clinician' and "health_exam_clinical_notes"."recorded_by" = current_setting('app.current_actor', true) and exists (select 1 from public.health_exams h
        join lateral public.actor_clinical_medico_ids(h.org_id) c(medico_id) on true
        where h.id = "health_exam_clinical_notes"."health_exam_id" and h.org_id = "health_exam_clinical_notes"."org_id" and c.medico_id = "health_exam_clinical_notes"."authored_by_medico_id"
          and (h.doctor_id = c.medico_id or exists (select 1 from public.pcmso_coordinator_assignments a
            where a.org_id = h.org_id and a.company_id = h.company_id and a.medico_id = c.medico_id and a.ends_on is null))));--> statement-breakpoint
ALTER POLICY "health_exam_work_restrictions_insert" ON "health_exam_work_restrictions" TO app_runtime WITH CHECK ("health_exam_work_restrictions"."recorded_by" = current_setting('app.current_actor', true) and exists (select 1 from public.health_exams h
        join lateral public.actor_clinical_medico_ids(h.org_id) c(medico_id) on true
        where h.id = "health_exam_work_restrictions"."health_exam_id" and h.org_id = "health_exam_work_restrictions"."org_id" and c.medico_id = "health_exam_work_restrictions"."authored_by_medico_id"
          and (h.doctor_id = c.medico_id or exists (select 1 from public.pcmso_coordinator_assignments a
            where a.org_id = h.org_id and a.company_id = h.company_id and a.medico_id = c.medico_id and a.ends_on is null))));--> statement-breakpoint
ALTER POLICY "absence_clinical_access_insert" ON "absence_clinical_access_events" TO app_runtime WITH CHECK ("absence_clinical_access_events"."actor_user_id" = current_setting('app.current_actor', true) and exists (select 1 from public.pcmso_coordinator_assignments a
        where a.org_id = "absence_clinical_access_events"."org_id" and a.company_id = "absence_clinical_access_events"."company_id" and a.ends_on is null and a.medico_id = "absence_clinical_access_events"."medico_id"
          and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))));--> statement-breakpoint
ALTER POLICY "absence_clinical_notes_coordinator" ON "employee_absence_clinical_notes" TO app_runtime USING (exists (select 1 from public.pcmso_coordinator_assignments a
        where a.org_id = "employee_absence_clinical_notes"."org_id" and a.company_id = "employee_absence_clinical_notes"."company_id" and a.ends_on is null
          and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id)))) WITH CHECK (exists (select 1 from public.pcmso_coordinator_assignments a
        where a.org_id = "employee_absence_clinical_notes"."org_id" and a.company_id = "employee_absence_clinical_notes"."company_id" and a.ends_on is null
          and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))));--> statement-breakpoint
ALTER POLICY "absence_clinical_notes_insert" ON "employee_absence_clinical_notes" TO app_runtime WITH CHECK ("employee_absence_clinical_notes"."recorded_by" = current_setting('app.current_actor', true) and exists (select 1 from public.pcmso_coordinator_assignments a
        where a.org_id = "employee_absence_clinical_notes"."org_id" and a.company_id = "employee_absence_clinical_notes"."company_id" and a.ends_on is null and a.medico_id = "employee_absence_clinical_notes"."authored_by_medico_id"
          and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))));--> statement-breakpoint
ALTER POLICY "exam_plan_items_insert" ON "medical_exam_plan_items" TO app_runtime WITH CHECK (exists (select 1 from public.medical_exam_plans p where p.id = "medical_exam_plan_items"."plan_id" and p.org_id = "medical_exam_plan_items"."org_id" and p.status = 'draft') and "medical_exam_plan_items"."created_by" = current_setting('app.current_actor', true) and ("medical_exam_plan_items"."origin" = 'suggested' or exists (select 1 from public.pcmso_coordinator_assignments a
    where a.org_id = "medical_exam_plan_items"."org_id" and a.company_id = "medical_exam_plan_items"."company_id" and a.ends_on is null
      and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id)))));--> statement-breakpoint
ALTER POLICY "exam_plan_items_coordinator_update" ON "medical_exam_plan_items" TO app_runtime USING (exists (select 1 from public.medical_exam_plans p where p.id = "medical_exam_plan_items"."plan_id" and p.org_id = "medical_exam_plan_items"."org_id" and p.status = 'draft') and exists (select 1 from public.pcmso_coordinator_assignments a
    where a.org_id = "medical_exam_plan_items"."org_id" and a.company_id = "medical_exam_plan_items"."company_id" and a.ends_on is null
      and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id)))) WITH CHECK (exists (select 1 from public.medical_exam_plans p where p.id = "medical_exam_plan_items"."plan_id" and p.org_id = "medical_exam_plan_items"."org_id" and p.status = 'draft') and exists (select 1 from public.pcmso_coordinator_assignments a
    where a.org_id = "medical_exam_plan_items"."org_id" and a.company_id = "medical_exam_plan_items"."company_id" and a.ends_on is null
      and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))) and "medical_exam_plan_items"."updated_by" = current_setting('app.current_actor', true));--> statement-breakpoint
ALTER POLICY "exam_plans_coordinator_transition" ON "medical_exam_plans" TO app_runtime USING ("medical_exam_plans"."status" in ('draft','approved') and exists (select 1 from public.pcmso_coordinator_assignments a
    where a.org_id = "medical_exam_plans"."org_id" and a.company_id = "medical_exam_plans"."company_id" and a.ends_on is null
      and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id)))) WITH CHECK (("medical_exam_plans"."status" = 'approved' and "medical_exam_plans"."approved_by_user" = current_setting('app.current_actor', true)) or "medical_exam_plans"."status" = 'superseded');--> statement-breakpoint
ALTER POLICY "medico_user_links_invited_insert" ON "medico_user_links" TO app_runtime WITH CHECK ("medico_user_links"."linked_by" = current_setting('app.current_actor', true) and "medico_user_links"."revoked_at" is null and exists (select 1 from public.medico_link_invitations i
        where i.id = "medico_user_links"."invitation_id" and i.org_id = "medico_user_links"."org_id" and i.medico_id = "medico_user_links"."medico_id" and i.user_id = "medico_user_links"."user_id"
          and not exists (select 1 from public.medico_link_invitation_events c where c.org_id = i.org_id and c.invitation_id = i.id and c.kind in ('declined','cancelled')) and i.expires_at > now()
          and exists (select 1 from public.medico_link_invitation_events a where a.org_id = i.org_id and a.invitation_id = i.id and a.kind = 'accepted' and a.actor_user_id = i.user_id)
          and (i.invited_by <> i.user_id or exists (select 1 from public.medico_link_invitation_events p where p.org_id = i.org_id and p.invitation_id = i.id and p.kind = 'approved' and p.actor_user_id <> i.user_id)
            or exists (select 1 from public.professional_identity_verifications v
        join public.medicos vm on vm.id = v.medico_id and vm.org_id = v.org_id
        where v.org_id = i.org_id and v.medico_id = i.medico_id and v.user_id = i.user_id
          and v.crm = vm.crm and v.registration_uf = vm.registration_uf and v.expires_at > now()
          and not exists (select 1 from public.professional_identity_review_events r
            where r.org_id = v.org_id and r.verification_id = v.id and r.kind = 'revoked')))));--> statement-breakpoint
ALTER POLICY "pcmso_analytical_reports_insert" ON "pcmso_analytical_reports" TO app_runtime WITH CHECK ("pcmso_analytical_reports"."generated_by" = current_setting('app.current_actor', true) and exists (select 1 from public.pcmso_coordinator_assignments a
        where a.org_id = "pcmso_analytical_reports"."org_id" and a.company_id = "pcmso_analytical_reports"."company_id" and a.ends_on is null
          and a.medico_id = "pcmso_analytical_reports"."authored_by_medico_id"
          and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))));--> statement-breakpoint
ALTER POLICY "pcmso_interpretation_criteria_insert" ON "pcmso_interpretation_criteria" TO app_runtime WITH CHECK ("pcmso_interpretation_criteria"."authored_by_user" = current_setting('app.current_actor', true) and exists (select 1 from public.pcmso_coordinator_assignments a
        where a.org_id = "pcmso_interpretation_criteria"."org_id" and a.company_id = "pcmso_interpretation_criteria"."company_id" and a.ends_on is null
          and a.medico_id = "pcmso_interpretation_criteria"."authored_by_medico_id"
          and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))));--> statement-breakpoint
REVOKE ALL ON public.identity_verifiers FROM app_runtime;--> statement-breakpoint
GRANT SELECT ON public.professional_identity_verifications TO app_runtime;--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON public.professional_identity_verifications FROM app_runtime;--> statement-breakpoint
GRANT SELECT ON public.professional_identity_review_events TO app_runtime;--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON public.professional_identity_review_events FROM app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT ON public.professional_identity_requests TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.professional_identity_requests FROM app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT ON public.medico_link_reconfirmations TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.medico_link_reconfirmations FROM app_runtime;--> statement-breakpoint
GRANT SELECT ON public.identity_verifiers, public.professional_identity_requests, public.professional_identity_verifications, public.professional_identity_review_events, public.medicos, public.org_memberships, public.orgs TO identity_verifier;--> statement-breakpoint
GRANT INSERT ON public.professional_identity_verifications, public.professional_identity_review_events TO identity_verifier;