CREATE TABLE "clinical_record_access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"health_exam_id" uuid NOT NULL,
	"medico_id" uuid NOT NULL,
	"basis" text NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_clinical_record_access_events_basis" CHECK ("clinical_record_access_events"."basis" in ('examiner','coordinator')),
	CONSTRAINT "ck_clinical_record_access_events_action" CHECK ("clinical_record_access_events"."action" in ('read','note_added','restriction_recorded'))
);
--> statement-breakpoint
ALTER TABLE "clinical_record_access_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "health_exam_clinical_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"health_exam_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"content" text NOT NULL,
	"authored_by_medico_id" uuid,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_health_exam_clinical_notes_origin" CHECK ("health_exam_clinical_notes"."origin" in ('clinician','legacy_exam_notes')),
	CONSTRAINT "ck_health_exam_clinical_notes_authorship" CHECK (("health_exam_clinical_notes"."origin" = 'clinician') = ("health_exam_clinical_notes"."recorded_by" is not null and "health_exam_clinical_notes"."authored_by_medico_id" is not null)),
	CONSTRAINT "ck_health_exam_clinical_notes_content" CHECK ("health_exam_clinical_notes"."origin" = 'legacy_exam_notes' or btrim("health_exam_clinical_notes"."content") <> '')
);
--> statement-breakpoint
ALTER TABLE "health_exam_clinical_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "health_exam_work_restrictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"health_exam_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"restriction" text,
	"authored_by_medico_id" uuid NOT NULL,
	"recorded_by" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_health_exam_work_restrictions_kind" CHECK (("health_exam_work_restrictions"."kind" = 'restriction' and "health_exam_work_restrictions"."restriction" is not null and btrim("health_exam_work_restrictions"."restriction") <> '') or ("health_exam_work_restrictions"."kind" = 'withdrawal' and "health_exam_work_restrictions"."restriction" is null))
);
--> statement-breakpoint
ALTER TABLE "health_exam_work_restrictions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "health_exams" ADD CONSTRAINT "uq_health_exams_id_org" UNIQUE("id","org_id");--> statement-breakpoint
ALTER TABLE "clinical_record_access_events" ADD CONSTRAINT "clinical_record_access_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_exam_clinical_notes" ADD CONSTRAINT "health_exam_clinical_notes_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_exam_clinical_notes" ADD CONSTRAINT "fk_health_exam_clinical_notes_exam" FOREIGN KEY ("health_exam_id","org_id") REFERENCES "public"."health_exams"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_exam_work_restrictions" ADD CONSTRAINT "health_exam_work_restrictions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_exam_work_restrictions" ADD CONSTRAINT "fk_health_exam_work_restrictions_exam" FOREIGN KEY ("health_exam_id","org_id") REFERENCES "public"."health_exams"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_clinical_record_access_events_exam" ON "clinical_record_access_events" USING btree ("org_id","health_exam_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_health_exam_clinical_notes_exam" ON "health_exam_clinical_notes" USING btree ("org_id","health_exam_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_health_exam_work_restrictions_exam" ON "health_exam_work_restrictions" USING btree ("org_id","health_exam_id","recorded_at");--> statement-breakpoint
-- NOB-155: as observações de health_exams.notes vão para o prontuário segregado, na mesma
-- transação da migration (nada fica exposto no caminho). Sem autoria médica presumida.
INSERT INTO public.health_exam_clinical_notes (org_id, health_exam_id, origin, content, recorded_at)
SELECT h.org_id, h.id, 'legacy_exam_notes', h.notes, h.updated_at FROM public.health_exams h WHERE h.notes IS NOT NULL;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.health_exams h
    WHERE h.notes IS NOT NULL AND (
      SELECT count(*) FROM public.health_exam_clinical_notes c
      WHERE c.health_exam_id = h.id AND c.org_id = h.org_id AND c.origin = 'legacy_exam_notes' AND c.content = h.notes
    ) <> 1
  ) THEN
    RAISE EXCEPTION 'NOB-155: migração das observações clínicas incompleta';
  END IF;
END $$;--> statement-breakpoint
-- Limpa o campo antigo sem tocar em updated_at (o histórico do cadastro não muda).
ALTER TABLE public.health_exams DISABLE TRIGGER set_updated_at_health_exams;--> statement-breakpoint
UPDATE public.health_exams SET notes = NULL WHERE notes IS NOT NULL;--> statement-breakpoint
ALTER TABLE public.health_exams ENABLE TRIGGER set_updated_at_health_exams;--> statement-breakpoint
ALTER TABLE "health_exams" ADD CONSTRAINT "ck_health_exams_notes_retired" CHECK ("health_exams"."notes" is null);--> statement-breakpoint
CREATE POLICY "clinical_record_access_events_isolation" ON "clinical_record_access_events" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "clinical_record_access_events_read" ON "clinical_record_access_events" AS RESTRICTIVE FOR SELECT TO "app_runtime" USING (exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = current_setting('app.current_actor', true) and m.role in ('owner','org:admin')) or "clinical_record_access_events"."actor_user_id" = current_setting('app.current_actor', true));--> statement-breakpoint
CREATE POLICY "clinical_record_access_events_insert" ON "clinical_record_access_events" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("clinical_record_access_events"."actor_user_id" = current_setting('app.current_actor', true) and exists (select 1 from public.health_exams h
        join public.medico_user_links l on l.org_id = h.org_id and l.revoked_at is null and l.user_id = current_setting('app.current_actor', true)
        join public.medicos m on m.id = l.medico_id and m.org_id = l.org_id and m.status = 'active' and m.profession = 'physician'
        join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
        where h.id = "clinical_record_access_events"."health_exam_id" and h.org_id = "clinical_record_access_events"."org_id" and l.medico_id = "clinical_record_access_events"."medico_id"
          and (h.doctor_id = l.medico_id or exists (select 1 from public.pcmso_coordinator_assignments a
            where a.org_id = h.org_id and a.company_id = h.company_id and a.medico_id = l.medico_id and a.ends_on is null))));--> statement-breakpoint
CREATE POLICY "health_exam_clinical_notes_isolation" ON "health_exam_clinical_notes" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "health_exam_clinical_notes_clinician" ON "health_exam_clinical_notes" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.health_exams h
        join public.medico_user_links l on l.org_id = h.org_id and l.revoked_at is null and l.user_id = current_setting('app.current_actor', true)
        join public.medicos m on m.id = l.medico_id and m.org_id = l.org_id and m.status = 'active' and m.profession = 'physician'
        join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
        where h.id = "health_exam_clinical_notes"."health_exam_id" and h.org_id = "health_exam_clinical_notes"."org_id"
          and (h.doctor_id = l.medico_id or exists (select 1 from public.pcmso_coordinator_assignments a
            where a.org_id = h.org_id and a.company_id = h.company_id and a.medico_id = l.medico_id and a.ends_on is null)))) WITH CHECK (exists (select 1 from public.health_exams h
        join public.medico_user_links l on l.org_id = h.org_id and l.revoked_at is null and l.user_id = current_setting('app.current_actor', true)
        join public.medicos m on m.id = l.medico_id and m.org_id = l.org_id and m.status = 'active' and m.profession = 'physician'
        join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
        where h.id = "health_exam_clinical_notes"."health_exam_id" and h.org_id = "health_exam_clinical_notes"."org_id"
          and (h.doctor_id = l.medico_id or exists (select 1 from public.pcmso_coordinator_assignments a
            where a.org_id = h.org_id and a.company_id = h.company_id and a.medico_id = l.medico_id and a.ends_on is null))));--> statement-breakpoint
CREATE POLICY "health_exam_clinical_notes_insert" ON "health_exam_clinical_notes" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("health_exam_clinical_notes"."origin" = 'clinician' and "health_exam_clinical_notes"."recorded_by" = current_setting('app.current_actor', true) and exists (select 1 from public.health_exams h
        join public.medico_user_links l on l.org_id = h.org_id and l.revoked_at is null and l.user_id = current_setting('app.current_actor', true)
        join public.medicos m on m.id = l.medico_id and m.org_id = l.org_id and m.status = 'active' and m.profession = 'physician'
        join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
        where h.id = "health_exam_clinical_notes"."health_exam_id" and h.org_id = "health_exam_clinical_notes"."org_id" and l.medico_id = "health_exam_clinical_notes"."authored_by_medico_id"
          and (h.doctor_id = l.medico_id or exists (select 1 from public.pcmso_coordinator_assignments a
            where a.org_id = h.org_id and a.company_id = h.company_id and a.medico_id = l.medico_id and a.ends_on is null))));--> statement-breakpoint
CREATE POLICY "health_exam_work_restrictions_isolation" ON "health_exam_work_restrictions" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "health_exam_work_restrictions_exam_scope" ON "health_exam_work_restrictions" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.health_exams h where h.id = "health_exam_work_restrictions"."health_exam_id" and h.org_id = "health_exam_work_restrictions"."org_id")) WITH CHECK (exists (select 1 from public.health_exams h where h.id = "health_exam_work_restrictions"."health_exam_id" and h.org_id = "health_exam_work_restrictions"."org_id"));--> statement-breakpoint
CREATE POLICY "health_exam_work_restrictions_insert" ON "health_exam_work_restrictions" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("health_exam_work_restrictions"."recorded_by" = current_setting('app.current_actor', true) and exists (select 1 from public.health_exams h
        join public.medico_user_links l on l.org_id = h.org_id and l.revoked_at is null and l.user_id = current_setting('app.current_actor', true)
        join public.medicos m on m.id = l.medico_id and m.org_id = l.org_id and m.status = 'active' and m.profession = 'physician'
        join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
        where h.id = "health_exam_work_restrictions"."health_exam_id" and h.org_id = "health_exam_work_restrictions"."org_id" and l.medico_id = "health_exam_work_restrictions"."authored_by_medico_id"
          and (h.doctor_id = l.medico_id or exists (select 1 from public.pcmso_coordinator_assignments a
            where a.org_id = h.org_id and a.company_id = h.company_id and a.medico_id = l.medico_id and a.ends_on is null))));--> statement-breakpoint
GRANT SELECT, INSERT ON public.health_exam_clinical_notes TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.health_exam_clinical_notes FROM app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT ON public.health_exam_work_restrictions TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.health_exam_work_restrictions FROM app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT ON public.clinical_record_access_events TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.clinical_record_access_events FROM app_runtime;