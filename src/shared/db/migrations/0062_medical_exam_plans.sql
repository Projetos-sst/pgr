CREATE TYPE "public"."exam_plan_item_decision" AS ENUM('kept', 'removed');--> statement-breakpoint
CREATE TYPE "public"."exam_plan_item_origin" AS ENUM('suggested', 'added');--> statement-breakpoint
CREATE TYPE "public"."exam_plan_status" AS ENUM('draft', 'approved', 'superseded');--> statement-breakpoint
CREATE TABLE "medical_exam_plan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"event" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "medical_exam_plan_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "medical_exam_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"exposure_group" text NOT NULL,
	"job_role" text DEFAULT '' NOT NULL,
	"procedure_code" text NOT NULL,
	"other_description" text,
	"origin" "exam_plan_item_origin" NOT NULL,
	"rule_id" text,
	"decision" "exam_plan_item_decision" DEFAULT 'kept' NOT NULL,
	"justification" text,
	"periodicity" text NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_exam_plan_items_code" CHECK ("medical_exam_plan_items"."procedure_code" ~ '^[0-9]{4}$'),
	CONSTRAINT "ck_exam_plan_items_other" CHECK (("medical_exam_plan_items"."procedure_code" = '9999') = ("medical_exam_plan_items"."other_description" is not null)),
	CONSTRAINT "ck_exam_plan_items_origin" CHECK (("medical_exam_plan_items"."origin" = 'suggested') = ("medical_exam_plan_items"."rule_id" is not null)),
	CONSTRAINT "ck_exam_plan_items_justification" CHECK (("medical_exam_plan_items"."decision" = 'kept' and "medical_exam_plan_items"."origin" = 'suggested') or "medical_exam_plan_items"."justification" is not null)
);
--> statement-breakpoint
ALTER TABLE "medical_exam_plan_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "medical_exam_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "exam_plan_status" DEFAULT 'draft' NOT NULL,
	"based_on" jsonb NOT NULL,
	"rules_version" text NOT NULL,
	"catalog_version" text NOT NULL,
	"prepared_by" text NOT NULL,
	"approved_by_user" text,
	"approved_by_medico_id" uuid,
	"approved_at" timestamp with time zone,
	"approval_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_exam_plans_identity" UNIQUE("id","org_id","company_id"),
	CONSTRAINT "uq_exam_plans_version" UNIQUE("org_id","company_id","version"),
	CONSTRAINT "ck_exam_plans_version" CHECK ("medical_exam_plans"."version" > 0),
	CONSTRAINT "ck_exam_plans_approval" CHECK (("medical_exam_plans"."status" = 'draft') = ("medical_exam_plans"."approved_at" is null) and ("medical_exam_plans"."approved_at" is null) = ("medical_exam_plans"."approved_by_user" is null) and ("medical_exam_plans"."approved_at" is null) = ("medical_exam_plans"."approved_by_medico_id" is null))
);
--> statement-breakpoint
ALTER TABLE "medical_exam_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "medical_exam_plan_events" ADD CONSTRAINT "medical_exam_plan_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_exam_plan_events" ADD CONSTRAINT "medical_exam_plan_events_plan_id_org_id_company_id_medical_exam_plans_id_org_id_company_id_fk" FOREIGN KEY ("plan_id","org_id","company_id") REFERENCES "public"."medical_exam_plans"("id","org_id","company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_exam_plan_items" ADD CONSTRAINT "medical_exam_plan_items_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_exam_plan_items" ADD CONSTRAINT "medical_exam_plan_items_plan_id_org_id_company_id_medical_exam_plans_id_org_id_company_id_fk" FOREIGN KEY ("plan_id","org_id","company_id") REFERENCES "public"."medical_exam_plans"("id","org_id","company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_exam_plans" ADD CONSTRAINT "medical_exam_plans_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_exam_plans" ADD CONSTRAINT "medical_exam_plans_company_id_org_id_companies_id_org_id_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_exam_plans" ADD CONSTRAINT "medical_exam_plans_approved_by_medico_id_org_id_medicos_id_org_id_fk" FOREIGN KEY ("approved_by_medico_id","org_id") REFERENCES "public"."medicos"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_exam_plan_events_plan" ON "medical_exam_plan_events" USING btree ("org_id","plan_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_exam_plan_items_procedure" ON "medical_exam_plan_items" USING btree ("plan_id","exposure_group","job_role","procedure_code");--> statement-breakpoint
CREATE INDEX "idx_exam_plan_items_plan" ON "medical_exam_plan_items" USING btree ("org_id","plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_exam_plans_open_draft" ON "medical_exam_plans" USING btree ("org_id","company_id") WHERE "medical_exam_plans"."status" = 'draft';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_exam_plans_approved" ON "medical_exam_plans" USING btree ("org_id","company_id") WHERE "medical_exam_plans"."status" = 'approved';--> statement-breakpoint
CREATE INDEX "idx_exam_plans_company" ON "medical_exam_plans" USING btree ("org_id","company_id","version");--> statement-breakpoint
CREATE POLICY "exam_plan_events_isolation" ON "medical_exam_plan_events" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "exam_plan_events_module_access" ON "medical_exam_plan_events" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "medical_exam_plan_events"."org_id" and cm.company_id = "medical_exam_plan_events"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "medical_exam_plan_events"."org_id" and cm.company_id = "medical_exam_plan_events"."company_id" and cm.module = 'medicine' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "exam_plan_events_actor_insert" ON "medical_exam_plan_events" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("medical_exam_plan_events"."actor" = current_setting('app.current_actor', true));--> statement-breakpoint
CREATE POLICY "exam_plan_items_isolation" ON "medical_exam_plan_items" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "exam_plan_items_module_access" ON "medical_exam_plan_items" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "medical_exam_plan_items"."org_id" and cm.company_id = "medical_exam_plan_items"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "medical_exam_plan_items"."org_id" and cm.company_id = "medical_exam_plan_items"."company_id" and cm.module = 'medicine' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "exam_plan_items_insert" ON "medical_exam_plan_items" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK (exists (select 1 from public.medical_exam_plans p where p.id = "medical_exam_plan_items"."plan_id" and p.org_id = "medical_exam_plan_items"."org_id" and p.status = 'draft') and "medical_exam_plan_items"."created_by" = current_setting('app.current_actor', true) and ("medical_exam_plan_items"."origin" = 'suggested' or exists (select 1 from public.pcmso_coordinator_assignments a
    join public.medico_user_links l on l.org_id = a.org_id and l.medico_id = a.medico_id and l.revoked_at is null
    join public.medicos m on m.id = a.medico_id and m.org_id = a.org_id and m.status = 'active'
    join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
    where a.org_id = "medical_exam_plan_items"."org_id" and a.company_id = "medical_exam_plan_items"."company_id" and a.ends_on is null and l.user_id = current_setting('app.current_actor', true))));--> statement-breakpoint
CREATE POLICY "exam_plan_items_coordinator_update" ON "medical_exam_plan_items" AS RESTRICTIVE FOR UPDATE TO "app_runtime" USING (exists (select 1 from public.medical_exam_plans p where p.id = "medical_exam_plan_items"."plan_id" and p.org_id = "medical_exam_plan_items"."org_id" and p.status = 'draft') and exists (select 1 from public.pcmso_coordinator_assignments a
    join public.medico_user_links l on l.org_id = a.org_id and l.medico_id = a.medico_id and l.revoked_at is null
    join public.medicos m on m.id = a.medico_id and m.org_id = a.org_id and m.status = 'active'
    join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
    where a.org_id = "medical_exam_plan_items"."org_id" and a.company_id = "medical_exam_plan_items"."company_id" and a.ends_on is null and l.user_id = current_setting('app.current_actor', true))) WITH CHECK (exists (select 1 from public.medical_exam_plans p where p.id = "medical_exam_plan_items"."plan_id" and p.org_id = "medical_exam_plan_items"."org_id" and p.status = 'draft') and exists (select 1 from public.pcmso_coordinator_assignments a
    join public.medico_user_links l on l.org_id = a.org_id and l.medico_id = a.medico_id and l.revoked_at is null
    join public.medicos m on m.id = a.medico_id and m.org_id = a.org_id and m.status = 'active'
    join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
    where a.org_id = "medical_exam_plan_items"."org_id" and a.company_id = "medical_exam_plan_items"."company_id" and a.ends_on is null and l.user_id = current_setting('app.current_actor', true)) and "medical_exam_plan_items"."updated_by" = current_setting('app.current_actor', true));--> statement-breakpoint
CREATE POLICY "exam_plans_isolation" ON "medical_exam_plans" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "exam_plans_module_access" ON "medical_exam_plans" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "medical_exam_plans"."org_id" and cm.company_id = "medical_exam_plans"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "medical_exam_plans"."org_id" and cm.company_id = "medical_exam_plans"."company_id" and cm.module = 'medicine' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "exam_plans_draft_insert" ON "medical_exam_plans" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("medical_exam_plans"."status" = 'draft' and "medical_exam_plans"."prepared_by" = current_setting('app.current_actor', true));--> statement-breakpoint
CREATE POLICY "exam_plans_coordinator_transition" ON "medical_exam_plans" AS RESTRICTIVE FOR UPDATE TO "app_runtime" USING ("medical_exam_plans"."status" in ('draft','approved') and exists (select 1 from public.pcmso_coordinator_assignments a
    join public.medico_user_links l on l.org_id = a.org_id and l.medico_id = a.medico_id and l.revoked_at is null
    join public.medicos m on m.id = a.medico_id and m.org_id = a.org_id and m.status = 'active'
    join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
    where a.org_id = "medical_exam_plans"."org_id" and a.company_id = "medical_exam_plans"."company_id" and a.ends_on is null and l.user_id = current_setting('app.current_actor', true))) WITH CHECK (("medical_exam_plans"."status" = 'approved' and "medical_exam_plans"."approved_by_user" = current_setting('app.current_actor', true)) or "medical_exam_plans"."status" = 'superseded');--> statement-breakpoint
GRANT SELECT, INSERT ON public.medical_exam_plans TO app_runtime;--> statement-breakpoint
GRANT UPDATE (status, approved_by_user, approved_by_medico_id, approved_at, approval_note, updated_at) ON public.medical_exam_plans TO app_runtime;--> statement-breakpoint
REVOKE DELETE ON public.medical_exam_plans FROM app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT ON public.medical_exam_plan_items TO app_runtime;--> statement-breakpoint
GRANT UPDATE (decision, justification, periodicity, updated_by, updated_at) ON public.medical_exam_plan_items TO app_runtime;--> statement-breakpoint
REVOKE DELETE ON public.medical_exam_plan_items FROM app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT ON public.medical_exam_plan_events TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.medical_exam_plan_events FROM app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_medical_exam_plans ON public.medical_exam_plans;--> statement-breakpoint
CREATE TRIGGER set_updated_at_medical_exam_plans BEFORE UPDATE ON public.medical_exam_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_medical_exam_plan_items ON public.medical_exam_plan_items;--> statement-breakpoint
CREATE TRIGGER set_updated_at_medical_exam_plan_items BEFORE UPDATE ON public.medical_exam_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
