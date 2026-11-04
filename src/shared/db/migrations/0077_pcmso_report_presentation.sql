CREATE TABLE "pcmso_analytical_report_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"report_sha256" text NOT NULL,
	"kind" text NOT NULL,
	"occurred_on" date,
	"modality" text,
	"participants" jsonb,
	"cipa_situation" text,
	"cipa_reference" text,
	"summary" text,
	"measures" jsonb,
	"evidence_reference" text,
	"note" text,
	"voids_id" uuid,
	"void_reason" text,
	"recorded_by" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_report_events_kind" CHECK ("pcmso_analytical_report_events"."kind" in ('finalized','presented','discussed','voided')),
	CONSTRAINT "ck_report_events_hash" CHECK ("pcmso_analytical_report_events"."report_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_report_events_meeting" CHECK (("pcmso_analytical_report_events"."kind" in ('presented','discussed')) = ("pcmso_analytical_report_events"."occurred_on" is not null)
        and ("pcmso_analytical_report_events"."kind" in ('presented','discussed')) = ("pcmso_analytical_report_events"."participants" is not null)
        and ("pcmso_analytical_report_events"."participants" is null or (jsonb_typeof("pcmso_analytical_report_events"."participants") = 'array' and jsonb_array_length("pcmso_analytical_report_events"."participants") > 0))),
	CONSTRAINT "ck_report_events_presented" CHECK (("pcmso_analytical_report_events"."kind" = 'presented') = ("pcmso_analytical_report_events"."modality" is not null)
        and ("pcmso_analytical_report_events"."kind" = 'presented') = ("pcmso_analytical_report_events"."cipa_situation" is not null)
        and ("pcmso_analytical_report_events"."modality" is null or "pcmso_analytical_report_events"."modality" in ('in_person','remote','hybrid'))
        and ("pcmso_analytical_report_events"."cipa_situation" is null or "pcmso_analytical_report_events"."cipa_situation" in ('participated','exists_not_participated','not_constituted','unknown'))
        and ("pcmso_analytical_report_events"."cipa_situation" is distinct from 'not_constituted' or char_length(btrim(coalesce("pcmso_analytical_report_events"."cipa_reference", ''))) >= 5)),
	CONSTRAINT "ck_report_events_discussed" CHECK (("pcmso_analytical_report_events"."kind" = 'discussed') = ("pcmso_analytical_report_events"."summary" is not null)
        and ("pcmso_analytical_report_events"."summary" is null or char_length(btrim("pcmso_analytical_report_events"."summary")) >= 10)
        and ("pcmso_analytical_report_events"."measures" is null or ("pcmso_analytical_report_events"."kind" = 'discussed' and jsonb_typeof("pcmso_analytical_report_events"."measures") = 'array'))),
	CONSTRAINT "ck_report_events_void" CHECK (("pcmso_analytical_report_events"."kind" = 'voided') = ("pcmso_analytical_report_events"."voids_id" is not null)
        and ("pcmso_analytical_report_events"."voids_id" is null) = ("pcmso_analytical_report_events"."void_reason" is null)
        and ("pcmso_analytical_report_events"."void_reason" is null or char_length(btrim("pcmso_analytical_report_events"."void_reason")) >= 10)
        and ("pcmso_analytical_report_events"."voids_id" is null or "pcmso_analytical_report_events"."voids_id" <> "pcmso_analytical_report_events"."id"))
);
--> statement-breakpoint
ALTER TABLE "pcmso_analytical_report_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pcmso_analytical_report_events" ADD CONSTRAINT "pcmso_analytical_report_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_report_events_id_scope" ON "pcmso_analytical_report_events" USING btree ("id","org_id","report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_report_events_voids" ON "pcmso_analytical_report_events" USING btree ("voids_id");--> statement-breakpoint
ALTER TABLE "pcmso_analytical_report_events" ADD CONSTRAINT "fk_report_events_company" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pcmso_analytical_report_events" ADD CONSTRAINT "fk_report_events_report" FOREIGN KEY ("report_id","org_id","company_id") REFERENCES "public"."pcmso_analytical_reports"("id","org_id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pcmso_analytical_report_events" ADD CONSTRAINT "fk_report_events_voids" FOREIGN KEY ("voids_id","org_id","report_id") REFERENCES "public"."pcmso_analytical_report_events"("id","org_id","report_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_report_events_company" ON "pcmso_analytical_report_events" USING btree ("org_id","company_id","recorded_at");--> statement-breakpoint
CREATE POLICY "report_events_isolation" ON "pcmso_analytical_report_events" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "report_events_module_access" ON "pcmso_analytical_report_events" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "pcmso_analytical_report_events"."org_id" and cm.company_id = "pcmso_analytical_report_events"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "pcmso_analytical_report_events"."org_id" and cm.company_id = "pcmso_analytical_report_events"."company_id" and cm.module = 'medicine' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "report_events_insert" ON "pcmso_analytical_report_events" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("pcmso_analytical_report_events"."recorded_by" = current_setting('app.current_actor', true)
        and exists (select 1 from public.pcmso_analytical_reports r where r.id = "pcmso_analytical_report_events"."report_id" and r.org_id = "pcmso_analytical_report_events"."org_id"
          and r.company_id = "pcmso_analytical_report_events"."company_id" and r.content_sha256 = "pcmso_analytical_report_events"."report_sha256"
          and ("pcmso_analytical_report_events"."kind" = 'voided' or not exists (select 1 from public.pcmso_analytical_reports n
            where n.org_id = r.org_id and n.company_id = r.company_id and n.version > r.version)))
        and (
          ("pcmso_analytical_report_events"."kind" = 'finalized' and exists (select 1 from public.pcmso_analytical_reports r
            join public.pcmso_coordinator_assignments a on a.org_id = r.org_id and a.company_id = r.company_id
              and a.medico_id = r.authored_by_medico_id and a.ends_on is null
            where r.id = "pcmso_analytical_report_events"."report_id" and r.org_id = "pcmso_analytical_report_events"."org_id"
              and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))))
          or ("pcmso_analytical_report_events"."kind" <> 'finalized' and exists (select 1 from public.org_memberships om where om.org_id = "pcmso_analytical_report_events"."org_id"
            and om.user_id = current_setting('app.current_actor', true) and om.role in ('owner','collaborator','org:admin','org:member')))
        ));
--> statement-breakpoint
-- Custom (NOB-168): regras que dependem de outros eventos do mesmo relatório (uma policy não pode
-- consultar a própria tabela sem recursão). SECURITY INVOKER: roda com a RLS de quem insere.
-- - apresentação exige finalização vigente pelo médico responsável;
-- - discussão exige apresentação vigente;
-- - não há duas finalizações vigentes da mesma versão;
-- - correção: alvo do mesmo relatório, que não seja outra correção; corrigir a finalização é só do
--   médico responsável que elaborou a versão.
CREATE OR REPLACE FUNCTION public.pcmso_report_event_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_kind text;
BEGIN
  IF NEW.kind IN ('presented', 'discussed') AND NOT EXISTS (
    SELECT 1 FROM public.pcmso_analytical_report_events f
    WHERE f.org_id = NEW.org_id AND f.report_id = NEW.report_id AND f.kind = 'finalized'
      AND NOT EXISTS (SELECT 1 FROM public.pcmso_analytical_report_events v
                      WHERE v.org_id = f.org_id AND v.voids_id = f.id)
  ) THEN
    RAISE EXCEPTION 'pcmso_report_event_guard: relatório sem finalização vigente do médico responsável'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.kind = 'discussed' AND NOT EXISTS (
    SELECT 1 FROM public.pcmso_analytical_report_events p
    WHERE p.org_id = NEW.org_id AND p.report_id = NEW.report_id AND p.kind = 'presented'
      AND NOT EXISTS (SELECT 1 FROM public.pcmso_analytical_report_events v
                      WHERE v.org_id = p.org_id AND v.voids_id = p.id)
  ) THEN
    RAISE EXCEPTION 'pcmso_report_event_guard: discussão sem apresentação vigente'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.kind = 'finalized' AND EXISTS (
    SELECT 1 FROM public.pcmso_analytical_report_events f
    WHERE f.org_id = NEW.org_id AND f.report_id = NEW.report_id AND f.kind = 'finalized'
      AND NOT EXISTS (SELECT 1 FROM public.pcmso_analytical_report_events v
                      WHERE v.org_id = f.org_id AND v.voids_id = f.id)
  ) THEN
    RAISE EXCEPTION 'pcmso_report_event_guard: versão já finalizada'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.kind = 'voided' THEN
    SELECT e.kind INTO target_kind FROM public.pcmso_analytical_report_events e
    WHERE e.id = NEW.voids_id AND e.org_id = NEW.org_id AND e.report_id = NEW.report_id;
    IF target_kind IS NULL OR target_kind = 'voided' THEN
      RAISE EXCEPTION 'pcmso_report_event_guard: correção sem registro válido a corrigir'
        USING ERRCODE = '42501';
    END IF;
    IF target_kind = 'finalized' AND NOT EXISTS (
      SELECT 1 FROM public.pcmso_analytical_reports r
      WHERE r.id = NEW.report_id AND r.org_id = NEW.org_id
        AND r.authored_by_medico_id IN (SELECT public.actor_clinical_medico_ids(NEW.org_id))
    ) THEN
      RAISE EXCEPTION 'pcmso_report_event_guard: só o médico responsável corrige a finalização'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.pcmso_report_event_guard() FROM PUBLIC;--> statement-breakpoint
CREATE TRIGGER pcmso_report_events_guard BEFORE INSERT ON public.pcmso_analytical_report_events
  FOR EACH ROW EXECUTE FUNCTION public.pcmso_report_event_guard();--> statement-breakpoint
-- Custom: eventos só de inclusão (sem UPDATE/DELETE para o app_runtime).
GRANT SELECT, INSERT ON public.pcmso_analytical_report_events TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.pcmso_analytical_report_events FROM app_runtime;