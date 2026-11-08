ALTER TABLE "medical_exam_plans" DROP CONSTRAINT "ck_exam_plans_approval";--> statement-breakpoint
ALTER TABLE "health_exams" DROP CONSTRAINT "health_exams_doctor_id_medicos_id_fk";
--> statement-breakpoint
ALTER TABLE "health_exams" ADD CONSTRAINT "health_exams_doctor_id_medicos_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_exam_plans" ADD CONSTRAINT "ck_exam_plans_approval" CHECK (("medical_exam_plans"."status" <> 'draft' or "medical_exam_plans"."approved_at" is null) and ("medical_exam_plans"."status" <> 'approved' or "medical_exam_plans"."approved_at" is not null) and ("medical_exam_plans"."approved_at" is null) = ("medical_exam_plans"."approved_by_user" is null) and ("medical_exam_plans"."approved_at" is null) = ("medical_exam_plans"."approved_by_medico_id" is null));--> statement-breakpoint
ALTER POLICY "exam_plans_coordinator_transition" ON "medical_exam_plans" TO app_runtime USING (("medical_exam_plans"."status" in ('draft','approved') and exists (select 1 from public.pcmso_coordinator_assignments a
    where a.org_id = "medical_exam_plans"."org_id" and a.company_id = "medical_exam_plans"."company_id"
      and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))
      and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))))
        or ("medical_exam_plans"."status" = 'draft' and exists (select 1 from public.org_memberships om where om.org_id = "medical_exam_plans"."org_id"
    and om.user_id = current_setting('app.current_actor', true) and om.role in ('owner','collaborator','org:admin','org:member')))) WITH CHECK (("medical_exam_plans"."status" = 'approved' and "medical_exam_plans"."approved_by_user" = current_setting('app.current_actor', true)
          and exists (select 1 from public.pcmso_coordinator_assignments a
    where a.org_id = "medical_exam_plans"."org_id" and a.company_id = "medical_exam_plans"."company_id" and a.medico_id = "medical_exam_plans"."approved_by_medico_id"
      and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))
      and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))))
        or ("medical_exam_plans"."status" = 'superseded' and "medical_exam_plans"."approved_at" is not null
          and exists (select 1 from public.pcmso_coordinator_assignments a
    where a.org_id = "medical_exam_plans"."org_id" and a.company_id = "medical_exam_plans"."company_id"
      and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))
      and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))))
        or ("medical_exam_plans"."status" = 'superseded' and "medical_exam_plans"."approved_at" is null and "medical_exam_plans"."approved_by_user" is null
          and "medical_exam_plans"."approved_by_medico_id" is null and "medical_exam_plans"."approval_note" is null
          and (exists (select 1 from public.org_memberships om where om.org_id = "medical_exam_plans"."org_id"
    and om.user_id = current_setting('app.current_actor', true) and om.role in ('owner','collaborator','org:admin','org:member')) or exists (select 1 from public.pcmso_coordinator_assignments a
    where a.org_id = "medical_exam_plans"."org_id" and a.company_id = "medical_exam_plans"."company_id"
      and a.starts_on <= (now() at time zone 'America/Sao_Paulo')::date and (a.ends_on is null or a.ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (select 1 from public.pcmso_coordinator_assignments concurrent
        where concurrent.org_id = a.org_id and concurrent.company_id = a.company_id
          and concurrent.id <> a.id and concurrent.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
          and (concurrent.ends_on is null or concurrent.ends_on >= (now() at time zone 'America/Sao_Paulo')::date))
      and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))))));--> statement-breakpoint
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
            and exists (select 1 from public.pcmso_documents dc where dc.id = "pcmso_signed_documents"."preview_document_id" and dc.org_id = "pcmso_signed_documents"."org_id"
              and dc.company_id = "pcmso_signed_documents"."company_id"
              and regexp_replace(dc.content->'coordinator'->>'crm', '[-./[:space:]]', '', 'g') ~ '^[0-9]+$'
              and regexp_replace(dc.content->'coordinator'->>'crm', '[-./[:space:]]', '', 'g') = regexp_replace(m.crm, '[-./[:space:]]', '', 'g')
              and upper(btrim(dc.content->'coordinator'->>'registrationUf')) = m.registration_uf)
            and ("pcmso_signed_documents"."origin" <> 'coordinator' or a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))))
        and ("pcmso_signed_documents"."origin" <> 'office_received' or exists (select 1 from public.org_memberships om where om.org_id = "pcmso_signed_documents"."org_id"
          and om.user_id = current_setting('app.current_actor', true) and om.role in ('owner','collaborator','org:admin','org:member'))));--> statement-breakpoint
-- Lote 3 do PCMSO — SQL que o drizzle-kit não emite. Acrescentar AO FINAL da 0081 gerada a partir
-- do schema (depois dos ALTER POLICY de "exam_plans_coordinator_transition" e
-- "pcmso_signed_documents_insert" e do DROP/ADD do CHECK "ck_exam_plans_approval", que o
-- drizzle-kit emite). Roda como owner (conexão direta). Sem backfill: planos antigos sem
-- `based_on.riskIds` seguem como legados (conferidos só pelas fontes, com aviso).
--
-- 1) Transições do plano de exames (NOB-150; MED-15). A policy de UPDATE só vê a linha nova; este
--    gatilho vê a antiga e impõe:
--    - identificação e proveniência nunca mudam (id, tenant, empresa, versão, based_on, regras,
--      catálogo, quem preparou, criação) — o GRANT por coluna já barra o app_runtime; aqui vale
--      para qualquer papel;
--    - rascunho → aprovado (a policy confere quem aprova) ou rascunho → rascunho/substituído sem
--      dados de aprovação (rascunho descartado nunca ganha aprovação forjada);
--    - aprovado → substituído, com approved_by_user, approved_by_medico_id, approved_at e
--      approval_note INALTERADOS (a aprovação gravada não é reescrita, nem pela coordenadora);
--    - substituído não muda mais.
--    SECURITY INVOKER: roda com os privilégios e a RLS de quem atualiza.
CREATE OR REPLACE FUNCTION public.medical_exam_plans_transition_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.based_on IS DISTINCT FROM OLD.based_on OR NEW.rules_version IS DISTINCT FROM OLD.rules_version
     OR NEW.catalog_version IS DISTINCT FROM OLD.catalog_version
     OR NEW.prepared_by IS DISTINCT FROM OLD.prepared_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'medical_exam_plans_transition_guard: identificação e proveniência do plano não mudam'
      USING ERRCODE = '42501';
  END IF;
  IF OLD.status = 'draft' THEN
    IF NEW.status <> 'approved' AND (NEW.approved_by_user IS NOT NULL OR NEW.approved_by_medico_id IS NOT NULL
        OR NEW.approved_at IS NOT NULL OR NEW.approval_note IS NOT NULL) THEN
      RAISE EXCEPTION 'medical_exam_plans_transition_guard: rascunho não recebe aprovação sem ser aprovado'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status = 'approved' THEN
    IF NEW.status <> 'superseded'
       OR NEW.approved_by_user IS DISTINCT FROM OLD.approved_by_user
       OR NEW.approved_by_medico_id IS DISTINCT FROM OLD.approved_by_medico_id
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.approval_note IS DISTINCT FROM OLD.approval_note THEN
      RAISE EXCEPTION 'medical_exam_plans_transition_guard: plano aprovado só passa a substituído, sem reescrever a aprovação'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'medical_exam_plans_transition_guard: plano substituído não muda'
    USING ERRCODE = '42501';
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.medical_exam_plans_transition_guard() FROM PUBLIC;--> statement-breakpoint
DROP TRIGGER IF EXISTS medical_exam_plans_transition_guard ON public.medical_exam_plans;--> statement-breakpoint
CREATE TRIGGER medical_exam_plans_transition_guard BEFORE UPDATE ON public.medical_exam_plans
  FOR EACH ROW EXECUTE FUNCTION public.medical_exam_plans_transition_guard();--> statement-breakpoint
-- Custom (NOB-110/NOB-112): registro profissional equivalente ("12.345" × "12345") também é
-- recusado pelo banco nas gravações NOVAS, inclusive por SQL direto como app_runtime. Sem índice
-- único canônico: duplicatas antigas da homologação fariam a migration falhar e continuam
-- existindo (nada é juntado, apagado ou corrigido). A regra espelha `shared/domains/pgr/medicos.ts`:
-- forma canônica = `canonicalRegistrationNumber`, chave do lock = `registrationLockKey`, edição sem
-- mudar o registro = `registrationIdentityChanged`. O caminho da aplicação continua conferindo
-- antes (mesmo lock, reentrante na mesma transação).
--
-- Forma canônica do número do registro: tira ponto, hífen, barra e exatamente os espaços que o
-- `\s` do JavaScript reconhece (U+0009–U+000D, U+0020, U+00A0, U+1680, U+2000–U+200A, U+2028,
-- U+2029, U+202F, U+205F, U+3000, U+FEFF), escritos com chr() para não haver caractere invisível
-- no arquivo. Devolve NULL se sobrar algo além de dígitos ASCII ou se não sobrar nada.
CREATE OR REPLACE FUNCTION public.medico_registration_canonical(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT CASE WHEN s ~ '^[0-9]+$' THEN s END
  FROM (
    SELECT translate(
      value,
      '.-/' || chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(32) || chr(160)
        || chr(5760) || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196)
        || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202)
        || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279),
      ''
    ) AS s
  ) AS stripped
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.medico_registration_canonical(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.medico_registration_canonical(text) TO app_runtime;--> statement-breakpoint
-- Guarda de gravação. SECURITY INVOKER: a busca roda com a RLS de quem grava (só o tenant da
-- sessão). Sem número canônico ou sem UF, não confere (mesmo comportamento da aplicação). Na
-- edição, só confere se mudou a categoria, o número canônico ou uma UF já informada: duplicatas
-- antigas continuam editáveis. Mensagem sem dado pessoal; o tipo vai no DETAIL.
CREATE OR REPLACE FUNCTION public.medicos_registration_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_number text := public.medico_registration_canonical(NEW.crm);
  v_uf text := nullif(upper(btrim(NEW.registration_uf)), '');
  v_old_uf text;
  v_same_uf boolean;
  v_missing_uf boolean;
BEGIN
  IF v_number IS NULL OR v_uf IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    v_old_uf := nullif(upper(btrim(OLD.registration_uf)), '');
    IF OLD.profession = NEW.profession
      AND public.medico_registration_canonical(OLD.crm) IS NOT DISTINCT FROM v_number
      AND (v_old_uf IS NULL OR v_old_uf = v_uf) THEN
      RETURN NEW;
    END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'medico-registration:' || NEW.org_id || ':' || NEW.profession::text || ':' || v_uf || ':' || v_number,
    0
  ));
  SELECT
    coalesce(bool_or(nullif(upper(btrim(m.registration_uf)), '') = v_uf), false),
    coalesce(bool_or(nullif(upper(btrim(m.registration_uf)), '') IS NULL), false)
  INTO v_same_uf, v_missing_uf
  FROM public.medicos m
  WHERE m.org_id = NEW.org_id
    AND m.profession = NEW.profession
    AND m.id IS DISTINCT FROM NEW.id
    AND public.medico_registration_canonical(m.crm) = v_number;
  IF v_same_uf OR v_missing_uf THEN
    RAISE EXCEPTION 'medicos_registration_guard: registro profissional equivalente já cadastrado neste escritório'
      USING ERRCODE = '23505',
        CONSTRAINT = 'medicos_registration_equivalent',
        DETAIL = CASE WHEN v_same_uf THEN 'same_uf' ELSE 'missing_uf' END;
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.medicos_registration_guard() FROM PUBLIC;--> statement-breakpoint
DROP TRIGGER IF EXISTS medicos_registration_guard ON public.medicos;--> statement-breakpoint
CREATE TRIGGER medicos_registration_guard
  BEFORE INSERT OR UPDATE OF crm, profession, registration_uf ON public.medicos
  FOR EACH ROW EXECUTE FUNCTION public.medicos_registration_guard();
