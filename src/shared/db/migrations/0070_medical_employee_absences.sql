CREATE TABLE "absence_clinical_access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"absence_id" uuid NOT NULL,
	"medico_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_absence_clinical_access_action" CHECK ("absence_clinical_access_events"."action" in ('read','note_added'))
);
--> statement-breakpoint
ALTER TABLE "absence_clinical_access_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employee_absence_clinical_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"absence_id" uuid NOT NULL,
	"cid" text,
	"worker_authorization" text,
	"content" text,
	"authored_by_medico_id" uuid NOT NULL,
	"recorded_by" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_absence_clinical_notes_cid" CHECK ("employee_absence_clinical_notes"."cid" is null or ("employee_absence_clinical_notes"."cid" ~ '^[A-TV-Z][0-9]{2}(\.[0-9A-Z]{1,2})?$' and "employee_absence_clinical_notes"."worker_authorization" is not null and btrim("employee_absence_clinical_notes"."worker_authorization") <> '')),
	CONSTRAINT "ck_absence_clinical_notes_content" CHECK ("employee_absence_clinical_notes"."cid" is not null or ("employee_absence_clinical_notes"."content" is not null and btrim("employee_absence_clinical_notes"."content") <> ''))
);
--> statement-breakpoint
ALTER TABLE "employee_absence_clinical_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employee_absence_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"absence_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ends_on" date,
	"returned_on" date,
	"actor_user_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_employee_absence_events_kind" CHECK ("employee_absence_events"."kind" in ('created','end_updated','returned','cancelled'))
);
--> statement-breakpoint
ALTER TABLE "employee_absence_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employee_absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"cause" text NOT NULL,
	"work_relation" text DEFAULT 'not_determined' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"returned_on" date,
	"return_recorded_by" text,
	"return_recorded_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"cancel_reason" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_changed_by" text NOT NULL,
	"last_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_employee_absences_identity" UNIQUE("id","org_id","company_id"),
	CONSTRAINT "ck_employee_absences_cause" CHECK ("employee_absences"."cause" in ('illness','accident','other')),
	CONSTRAINT "ck_employee_absences_relation" CHECK ("employee_absences"."work_relation" in ('occupational','non_occupational','not_determined') and ("employee_absences"."cause" <> 'other' or "employee_absences"."work_relation" = 'not_determined')),
	CONSTRAINT "ck_employee_absences_period" CHECK ("employee_absences"."ends_on" is null or "employee_absences"."ends_on" >= "employee_absences"."starts_on"),
	CONSTRAINT "ck_employee_absences_return" CHECK (("employee_absences"."returned_on" is null and "employee_absences"."return_recorded_by" is null and "employee_absences"."return_recorded_at" is null) or ("employee_absences"."returned_on" > "employee_absences"."starts_on" and "employee_absences"."ends_on" = "employee_absences"."returned_on" - 1 and "employee_absences"."return_recorded_by" is not null and "employee_absences"."return_recorded_at" is not null)),
	CONSTRAINT "ck_employee_absences_cancel" CHECK (("employee_absences"."cancelled_at" is null) = ("employee_absences"."cancelled_by" is null) and ("employee_absences"."cancelled_at" is null) = ("employee_absences"."cancel_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "employee_absences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "absence_clinical_access_events" ADD CONSTRAINT "absence_clinical_access_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_absence_clinical_notes" ADD CONSTRAINT "fk_absence_clinical_notes_absence" FOREIGN KEY ("absence_id","org_id","company_id") REFERENCES "public"."employee_absences"("id","org_id","company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_absence_events" ADD CONSTRAINT "fk_employee_absence_events_absence" FOREIGN KEY ("absence_id","org_id","company_id") REFERENCES "public"."employee_absences"("id","org_id","company_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_absences" ADD CONSTRAINT "employee_absences_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_absences" ADD CONSTRAINT "fk_employee_absences_company" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_absences" ADD CONSTRAINT "fk_employee_absences_employee" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_absence_clinical_access_absence" ON "absence_clinical_access_events" USING btree ("org_id","absence_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_absence_clinical_notes_absence" ON "employee_absence_clinical_notes" USING btree ("org_id","absence_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_employee_absence_events_absence" ON "employee_absence_events" USING btree ("org_id","absence_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_employee_absences_employee" ON "employee_absences" USING btree ("org_id","employee_id","starts_on");--> statement-breakpoint
CREATE POLICY "absence_clinical_access_isolation" ON "absence_clinical_access_events" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "absence_clinical_access_read" ON "absence_clinical_access_events" AS RESTRICTIVE FOR SELECT TO "app_runtime" USING (exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = current_setting('app.current_actor', true) and m.role in ('owner','org:admin')) or "absence_clinical_access_events"."actor_user_id" = current_setting('app.current_actor', true));--> statement-breakpoint
CREATE POLICY "absence_clinical_access_insert" ON "absence_clinical_access_events" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("absence_clinical_access_events"."actor_user_id" = current_setting('app.current_actor', true) and exists (select 1 from public.pcmso_coordinator_assignments a
        join public.medico_user_links l on l.org_id = a.org_id and l.medico_id = a.medico_id and l.revoked_at is null and l.user_id = current_setting('app.current_actor', true)
        join public.medicos m on m.id = a.medico_id and m.org_id = a.org_id and m.status = 'active' and m.profession = 'physician'
        join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
        where a.org_id = "absence_clinical_access_events"."org_id" and a.company_id = "absence_clinical_access_events"."company_id" and a.ends_on is null and l.medico_id = "absence_clinical_access_events"."medico_id"));--> statement-breakpoint
CREATE POLICY "absence_clinical_notes_isolation" ON "employee_absence_clinical_notes" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "absence_clinical_notes_coordinator" ON "employee_absence_clinical_notes" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.pcmso_coordinator_assignments a
        join public.medico_user_links l on l.org_id = a.org_id and l.medico_id = a.medico_id and l.revoked_at is null and l.user_id = current_setting('app.current_actor', true)
        join public.medicos m on m.id = a.medico_id and m.org_id = a.org_id and m.status = 'active' and m.profession = 'physician'
        join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
        where a.org_id = "employee_absence_clinical_notes"."org_id" and a.company_id = "employee_absence_clinical_notes"."company_id" and a.ends_on is null)) WITH CHECK (exists (select 1 from public.pcmso_coordinator_assignments a
        join public.medico_user_links l on l.org_id = a.org_id and l.medico_id = a.medico_id and l.revoked_at is null and l.user_id = current_setting('app.current_actor', true)
        join public.medicos m on m.id = a.medico_id and m.org_id = a.org_id and m.status = 'active' and m.profession = 'physician'
        join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
        where a.org_id = "employee_absence_clinical_notes"."org_id" and a.company_id = "employee_absence_clinical_notes"."company_id" and a.ends_on is null));--> statement-breakpoint
CREATE POLICY "absence_clinical_notes_insert" ON "employee_absence_clinical_notes" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("employee_absence_clinical_notes"."recorded_by" = current_setting('app.current_actor', true) and exists (select 1 from public.pcmso_coordinator_assignments a
        join public.medico_user_links l on l.org_id = a.org_id and l.medico_id = a.medico_id and l.revoked_at is null and l.user_id = current_setting('app.current_actor', true)
        join public.medicos m on m.id = a.medico_id and m.org_id = a.org_id and m.status = 'active' and m.profession = 'physician'
        join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
        where a.org_id = "employee_absence_clinical_notes"."org_id" and a.company_id = "employee_absence_clinical_notes"."company_id" and a.ends_on is null and l.medico_id = "employee_absence_clinical_notes"."authored_by_medico_id"));--> statement-breakpoint
CREATE POLICY "employee_absence_events_isolation" ON "employee_absence_events" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "employee_absence_events_module_access" ON "employee_absence_events" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "employee_absence_events"."org_id" and cm.company_id = "employee_absence_events"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "employee_absence_events"."org_id" and cm.company_id = "employee_absence_events"."company_id" and cm.module = 'medicine' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "employee_absence_events_insert" ON "employee_absence_events" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("employee_absence_events"."actor_user_id" = current_setting('app.current_actor', true));--> statement-breakpoint
CREATE POLICY "employee_absences_isolation" ON "employee_absences" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "employee_absences_module_access" ON "employee_absences" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "employee_absences"."org_id" and cm.company_id = "employee_absences"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "employee_absences"."org_id" and cm.company_id = "employee_absences"."company_id" and cm.module = 'medicine' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "employee_absences_insert" ON "employee_absences" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("employee_absences"."created_by" = current_setting('app.current_actor', true) and "employee_absences"."last_changed_by" = current_setting('app.current_actor', true) and "employee_absences"."returned_on" is null and "employee_absences"."cancelled_at" is null);--> statement-breakpoint
CREATE POLICY "employee_absences_update" ON "employee_absences" AS RESTRICTIVE FOR UPDATE TO "app_runtime" USING ("employee_absences"."returned_on" is null and "employee_absences"."cancelled_at" is null) WITH CHECK ("employee_absences"."last_changed_by" = current_setting('app.current_actor', true));--> statement-breakpoint
GRANT SELECT, INSERT ON public.employee_absences TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.employee_absences FROM app_runtime;--> statement-breakpoint
GRANT UPDATE (ends_on, returned_on, return_recorded_by, return_recorded_at, cancelled_at, cancelled_by, cancel_reason, last_changed_by, last_changed_at) ON public.employee_absences TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT ON public.employee_absence_events TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.employee_absence_events FROM app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT ON public.employee_absence_clinical_notes TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.employee_absence_clinical_notes FROM app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT ON public.absence_clinical_access_events TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.absence_clinical_access_events FROM app_runtime;