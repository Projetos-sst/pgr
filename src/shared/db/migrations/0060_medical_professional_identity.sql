CREATE TYPE "public"."medical_affiliation" AS ENUM('internal', 'external');--> statement-breakpoint
CREATE TYPE "public"."medical_profession" AS ENUM('physician', 'psychologist');--> statement-breakpoint
CREATE TABLE "pcmso_coordinator_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"medico_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"rqe_exception_reason" text,
	"end_reason" text,
	"created_by" text NOT NULL,
	"ended_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_pcmso_coordinators_period" CHECK ("pcmso_coordinator_assignments"."ends_on" is null or "pcmso_coordinator_assignments"."ends_on" >= "pcmso_coordinator_assignments"."starts_on"),
	CONSTRAINT "ck_pcmso_coordinators_end_reason" CHECK (("pcmso_coordinator_assignments"."ends_on" is null) = ("pcmso_coordinator_assignments"."end_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "pcmso_coordinator_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "medicos" ADD COLUMN "profession" "medical_profession" DEFAULT 'physician' NOT NULL;--> statement-breakpoint
ALTER TABLE "medicos" ADD COLUMN "registration_uf" text;--> statement-breakpoint
ALTER TABLE "medicos" ADD COLUMN "rqe" text;--> statement-breakpoint
ALTER TABLE "medicos" ADD COLUMN "affiliation" "medical_affiliation" DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "pcmso_coordinator_assignments" ADD CONSTRAINT "pcmso_coordinator_assignments_company_id_org_id_companies_id_org_id_fk" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Ordem manual: a FK composta (medico_id, org_id) exige o índice único antes dela.
CREATE UNIQUE INDEX "uq_medicos_id_org" ON "medicos" USING btree ("id","org_id");--> statement-breakpoint
ALTER TABLE "pcmso_coordinator_assignments" ADD CONSTRAINT "pcmso_coordinator_assignments_medico_id_org_id_medicos_id_org_id_fk" FOREIGN KEY ("medico_id","org_id") REFERENCES "public"."medicos"("id","org_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pcmso_coordinators_company" ON "pcmso_coordinator_assignments" USING btree ("org_id","company_id","starts_on");--> statement-breakpoint
CREATE INDEX "idx_pcmso_coordinators_medico" ON "pcmso_coordinator_assignments" USING btree ("medico_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pcmso_coordinators_open" ON "pcmso_coordinator_assignments" USING btree ("org_id","company_id") WHERE "pcmso_coordinator_assignments"."ends_on" is null;--> statement-breakpoint
ALTER TABLE "medicos" ADD CONSTRAINT "ck_medicos_registration_uf" CHECK ("medicos"."registration_uf" is null or "medicos"."registration_uf" ~ '^[A-Z]{2}$');--> statement-breakpoint
ALTER TABLE "medicos" ADD CONSTRAINT "ck_medicos_rqe_physician" CHECK ("medicos"."rqe" is null or "medicos"."profession" = 'physician');--> statement-breakpoint
CREATE POLICY "pcmso_coordinators_isolation" ON "pcmso_coordinator_assignments" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "pcmso_coordinators_module_access" ON "pcmso_coordinator_assignments" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "pcmso_coordinator_assignments"."org_id" and cm.company_id = "pcmso_coordinator_assignments"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "pcmso_coordinator_assignments"."org_id" and cm.company_id = "pcmso_coordinator_assignments"."company_id" and cm.module = 'medicine' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "pcmso_coordinators_owner_insert" ON "pcmso_coordinator_assignments" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK (exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = current_setting('app.current_actor', true) and m.role in ('owner','org:admin')) and "pcmso_coordinator_assignments"."created_by" = current_setting('app.current_actor', true));--> statement-breakpoint
CREATE POLICY "pcmso_coordinators_owner_close" ON "pcmso_coordinator_assignments" AS RESTRICTIVE FOR UPDATE TO "app_runtime" USING ("pcmso_coordinator_assignments"."ends_on" is null and exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = current_setting('app.current_actor', true) and m.role in ('owner','org:admin'))) WITH CHECK ("pcmso_coordinator_assignments"."ended_by" = current_setting('app.current_actor', true));--> statement-breakpoint
-- Custom SQL (não emitido pelo drizzle-kit): o app_runtime nunca apaga o histórico
-- e só altera as colunas de encerramento.
GRANT SELECT, INSERT ON public.pcmso_coordinator_assignments TO app_runtime;--> statement-breakpoint
GRANT UPDATE (ends_on, end_reason, ended_by, updated_at) ON public.pcmso_coordinator_assignments TO app_runtime;--> statement-breakpoint
REVOKE DELETE ON public.pcmso_coordinator_assignments FROM app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_pcmso_coordinator_assignments ON public.pcmso_coordinator_assignments;--> statement-breakpoint
CREATE TRIGGER set_updated_at_pcmso_coordinator_assignments BEFORE UPDATE ON public.pcmso_coordinator_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
