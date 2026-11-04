CREATE TABLE "pcmso_signed_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"preview_document_id" uuid NOT NULL,
	"preview_sha256" text NOT NULL,
	"exam_plan_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"signature_method" text NOT NULL,
	"signer_name" text NOT NULL,
	"signer_registration" text NOT NULL,
	"signer_uf" text NOT NULL,
	"signed_on" date NOT NULL,
	"verification_kind" text DEFAULT 'documentary' NOT NULL,
	"verification_reference" text NOT NULL,
	"storage_path" text NOT NULL,
	"file_sha256" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"replaces_id" uuid,
	"change_kind" text,
	"replace_reason" text,
	"registered_by" text NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_pcmso_signed_origin" CHECK ("pcmso_signed_documents"."origin" in ('coordinator','office_received')),
	CONSTRAINT "ck_pcmso_signed_method" CHECK ("pcmso_signed_documents"."signature_method" in ('icp_brasil','electronic','handwritten')),
	CONSTRAINT "ck_pcmso_signed_verification_kind" CHECK ("pcmso_signed_documents"."verification_kind" = 'documentary'),
	CONSTRAINT "ck_pcmso_signed_verification" CHECK (char_length(btrim("pcmso_signed_documents"."verification_reference")) >= 5),
	CONSTRAINT "ck_pcmso_signed_uf" CHECK ("pcmso_signed_documents"."signer_uf" ~ '^[A-Z]{2}$'),
	CONSTRAINT "ck_pcmso_signed_signer" CHECK (btrim("pcmso_signed_documents"."signer_name") <> '' and btrim("pcmso_signed_documents"."signer_registration") <> ''),
	CONSTRAINT "ck_pcmso_signed_hashes" CHECK ("pcmso_signed_documents"."file_sha256" ~ '^[0-9a-f]{64}$' and "pcmso_signed_documents"."preview_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_pcmso_signed_size" CHECK ("pcmso_signed_documents"."size_bytes" > 0),
	CONSTRAINT "ck_pcmso_signed_replace" CHECK (("pcmso_signed_documents"."replaces_id" is null) = ("pcmso_signed_documents"."replace_reason" is null)
        and ("pcmso_signed_documents"."replaces_id" is null) = ("pcmso_signed_documents"."change_kind" is null)
        and ("pcmso_signed_documents"."change_kind" is null or "pcmso_signed_documents"."change_kind" in ('administrative','documentary_update','clinical_revision','correction'))
        and ("pcmso_signed_documents"."replace_reason" is null or char_length(btrim("pcmso_signed_documents"."replace_reason")) >= 10)
        and ("pcmso_signed_documents"."replaces_id" is null or "pcmso_signed_documents"."replaces_id" <> "pcmso_signed_documents"."id"))
);
--> statement-breakpoint
ALTER TABLE "pcmso_signed_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pcmso_documents" ADD COLUMN "risk_basis_digest" text;--> statement-breakpoint
ALTER TABLE "pcmso_signed_documents" ADD CONSTRAINT "pcmso_signed_documents_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pcmso_signed_id_scope" ON "pcmso_signed_documents" USING btree ("id","org_id","company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pcmso_signed_replaces" ON "pcmso_signed_documents" USING btree ("replaces_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pcmso_signed_storage_path" ON "pcmso_signed_documents" USING btree ("storage_path");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pcmso_documents_id_scope" ON "pcmso_documents" USING btree ("id","org_id","company_id");--> statement-breakpoint
ALTER TABLE "pcmso_signed_documents" ADD CONSTRAINT "fk_pcmso_signed_company" FOREIGN KEY ("company_id","org_id") REFERENCES "public"."companies"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pcmso_signed_documents" ADD CONSTRAINT "fk_pcmso_signed_preview" FOREIGN KEY ("preview_document_id","org_id","company_id") REFERENCES "public"."pcmso_documents"("id","org_id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pcmso_signed_documents" ADD CONSTRAINT "fk_pcmso_signed_plan" FOREIGN KEY ("exam_plan_id","org_id","company_id") REFERENCES "public"."medical_exam_plans"("id","org_id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pcmso_signed_documents" ADD CONSTRAINT "fk_pcmso_signed_replaces" FOREIGN KEY ("replaces_id","org_id","company_id") REFERENCES "public"."pcmso_signed_documents"("id","org_id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pcmso_signed_company" ON "pcmso_signed_documents" USING btree ("org_id","company_id","registered_at");--> statement-breakpoint
-- Custom (NOB-166): resumo da base de riscos da empresa, calculado no banco. Cobre as fontes vigentes
-- (não substituídas) com versão, a situação de cada risco (id e status) e, para fonte interna, o
-- conteúdo atual do PGR de origem (data, revisão e riscos com a última avaliação). Qualquer mudança
-- muda o resumo. SECURITY INVOKER: roda com a RLS e o tenant de quem chama.
CREATE OR REPLACE FUNCTION public.medical_risk_basis_digest(p_org text, p_company uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object(
      'id', ms.id,
      'version', ms.version,
      'entries', (select coalesce(jsonb_agg(jsonb_build_array(e.id, e.status) order by e.id), '[]'::jsonb)
                  from public.medical_risk_entries e
                  where e.org_id = ms.org_id and e.company_id = ms.company_id and e.source_id = ms.id),
      'pgr', case when ms.origin_pgr_id is null then null else (
        select jsonb_build_object(
          'updatedAt', p.updated_at,
          'revision', (select max(rv.revision_number) from public.pgr_revisions rv where rv.pgr_id = p.id and rv.org_id = p.org_id),
          'risks', (select coalesce(jsonb_agg(jsonb_build_array(
                      to_jsonb(r) - 'org_id',
                      (select to_jsonb(a) - 'org_id' from public.risk_assessments a
                        where a.risk_id = r.id and a.org_id = r.org_id
                        order by a.assessed_at desc, a.id desc limit 1)
                    ) order by g.id, r.id), '[]'::jsonb)
                    from public.pgr_ges pg
                    join public.ges g on g.id = pg.ges_id and g.org_id = p.org_id and g.company_id = p.company_id
                    join public.risks r on r.ges_id = g.id and r.org_id = p.org_id
                    where pg.pgr_id = p.id and pg.org_id = p.org_id))
        from public.pgr p
        where p.id = ms.origin_pgr_id and p.org_id = ms.org_id and p.company_id = ms.company_id) end
    ) order by ms.id), '[]'::jsonb)::text, 'UTF8')), 'hex')
  from public.medical_risk_sources ms
  where ms.org_id = p_org and ms.company_id = p_company
    and not exists (select 1 from public.medical_risk_sources nx
                    where nx.org_id = ms.org_id and nx.company_id = ms.company_id and nx.supersedes_source_id = ms.id)
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.medical_risk_basis_digest(text, uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.medical_risk_basis_digest(text, uuid) TO app_runtime;--> statement-breakpoint
CREATE POLICY "pcmso_signed_documents_isolation" ON "pcmso_signed_documents" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "pcmso_signed_documents_module_access" ON "pcmso_signed_documents" AS RESTRICTIVE FOR ALL TO "app_runtime" USING (exists (select 1 from public.company_modules cm where cm.org_id = "pcmso_signed_documents"."org_id" and cm.company_id = "pcmso_signed_documents"."company_id" and cm.module = 'medicine' and cm.enabled = true)) WITH CHECK (exists (select 1 from public.company_modules cm where cm.org_id = "pcmso_signed_documents"."org_id" and cm.company_id = "pcmso_signed_documents"."company_id" and cm.module = 'medicine' and cm.enabled = true));--> statement-breakpoint
CREATE POLICY "pcmso_signed_documents_insert" ON "pcmso_signed_documents" AS RESTRICTIVE FOR INSERT TO "app_runtime" WITH CHECK ("pcmso_signed_documents"."registered_by" = current_setting('app.current_actor', true)
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
          where a.org_id = "pcmso_signed_documents"."org_id" and a.company_id = "pcmso_signed_documents"."company_id" and a.ends_on is null
            and m.crm = "pcmso_signed_documents"."signer_registration" and m.registration_uf = "pcmso_signed_documents"."signer_uf"
            and ("pcmso_signed_documents"."origin" <> 'coordinator' or a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))))
        and ("pcmso_signed_documents"."origin" <> 'office_received' or exists (select 1 from public.org_memberships om where om.org_id = "pcmso_signed_documents"."org_id"
          and om.user_id = current_setting('app.current_actor', true) and om.role in ('owner','collaborator','org:admin','org:member'))));--> statement-breakpoint
ALTER POLICY "pcmso_documents_insert" ON "pcmso_documents" TO app_runtime WITH CHECK ("pcmso_documents"."generated_by" = current_setting('app.current_actor', true) and exists (select 1 from public.medical_exam_plans p where p.id = "pcmso_documents"."exam_plan_id" and p.org_id = "pcmso_documents"."org_id" and p.company_id = "pcmso_documents"."company_id" and p.status = 'approved')
        and "pcmso_documents"."risk_basis_digest" is not null and "pcmso_documents"."risk_basis_digest" = public.medical_risk_basis_digest("pcmso_documents"."org_id", "pcmso_documents"."company_id"));--> statement-breakpoint
-- Custom: PCMSO assinado só inclusão (sem UPDATE/DELETE para o app_runtime).
GRANT SELECT, INSERT ON public.pcmso_signed_documents TO app_runtime;--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.pcmso_signed_documents FROM app_runtime;