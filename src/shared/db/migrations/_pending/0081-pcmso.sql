-- Lote 3 do PCMSO — SQL que o drizzle-kit não emite. Acrescentar AO FINAL da 0081 gerada a partir
-- do schema (depois dos ALTER POLICY de "exam_plans_coordinator_transition" e
-- "pcmso_signed_documents_insert"). Roda como owner (conexão direta).
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
  FOR EACH ROW EXECUTE FUNCTION public.medical_exam_plans_transition_guard();
