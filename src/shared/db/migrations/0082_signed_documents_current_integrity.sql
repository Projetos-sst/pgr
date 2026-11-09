-- Lote 4 (NOB-109/NOB-110, hardening de NOB-163/NOB-166): vigência única dos documentos assinados.
--
-- Vigente = registro que nenhum outro substitui. ASO: por exame (org_id, health_exam_id). PCMSO:
-- por empresa (org_id, company_id) — nova versão, inclusive de novo ciclo, substitui a anterior com
-- tipo de mudança. Com replaces_id único (uq_*_replaces) e a FK composta de substituição no mesmo
-- contexto, as versões formam cadeias e o número de vigentes é o número de raízes (replaces_id
-- nulo). Hoje só o app impunha uma raiz por contexto; o INSERT direto da role da aplicação (RLS de
-- inclusão aprovada) e duas transações concorrentes conseguiam criar duas vigentes.
--
-- Estratégia: gatilho AFTER INSERT, por linha — depois da RLS (quem não pode gravar recebe 42501,
-- nunca um conflito de vigência que revelaria o estado do documento) e com a linha nova já visível.
-- Trava o contexto com pg_advisory_xact_lock (mesma chave do app no PCMSO; no ASO o app já trava a
-- linha do exame antes, sem ciclo de espera) e, com a trava, lê as vigentes do contexto (cada comando
-- plpgsql tem novo snapshot em READ COMMITTED: a segunda transação vê o que a primeira gravou). Depois
-- da inclusão o contexto precisa ter UMA vigente, e ela é a nova; senão a inclusão é desfeita:
--   - nova raiz com vigente existente → current_exists;
--   - contexto com mais de uma vigente anterior (legado) → ambiguous (falha fechada, sem escolher);
--   - substituir versão já substituída já é barrado por uq_*_replaces.
-- Recusa: SQLSTATE 23505, CONSTRAINT lógica *_signed_current_unique, DETAIL current_exists|ambiguous.
--
-- Sem índice único parcial: o banco de homologação nunca foi inventariado e um legado com duas
-- raízes faria a migration falhar no CD. O gatilho não lê nem altera linhas existentes: nenhum
-- documento, hash ou arquivo é tocado. UPDATE e DELETE seguem revogados do app_runtime (0073/0075).
-- SECURITY INVOKER: a leitura obedece à RLS de quem grava (o contexto é do próprio tenant).
CREATE OR REPLACE FUNCTION public.aso_signed_current_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  currents uuid[];
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('aso-signed:' || NEW.org_id || ':' || NEW.health_exam_id::text, 0));
  SELECT coalesce(array_agg(s.id), '{}') INTO currents
    FROM public.aso_signed_documents s
   WHERE s.org_id = NEW.org_id AND s.health_exam_id = NEW.health_exam_id
     AND NOT EXISTS (SELECT 1 FROM public.aso_signed_documents r
                      WHERE r.org_id = s.org_id AND r.replaces_id = s.id);
  IF cardinality(currents) <> 1 OR currents[1] <> NEW.id THEN
    RAISE EXCEPTION USING ERRCODE = '23505', CONSTRAINT = 'aso_signed_current_unique',
      TABLE = 'aso_signed_documents', MESSAGE = 'aso_signed_current_unique',
      DETAIL = CASE WHEN cardinality(currents) > 2 OR (cardinality(currents) > 1 AND NEW.replaces_id IS NOT NULL) THEN 'ambiguous' ELSE 'current_exists' END;
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.aso_signed_current_guard() FROM PUBLIC;
--> statement-breakpoint
DROP TRIGGER IF EXISTS aso_signed_current_guard ON public.aso_signed_documents;
--> statement-breakpoint
CREATE TRIGGER aso_signed_current_guard AFTER INSERT ON public.aso_signed_documents
  FOR EACH ROW EXECUTE FUNCTION public.aso_signed_current_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.pcmso_signed_current_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  currents uuid[];
BEGIN
  -- Mesma chave do registro no app (repositories/pcmso-documents.ts): trava reentrante na transação.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('pcmso-signed:' || NEW.org_id || ':' || NEW.company_id::text, 0));
  SELECT coalesce(array_agg(s.id), '{}') INTO currents
    FROM public.pcmso_signed_documents s
   WHERE s.org_id = NEW.org_id AND s.company_id = NEW.company_id
     AND NOT EXISTS (SELECT 1 FROM public.pcmso_signed_documents r
                      WHERE r.org_id = s.org_id AND r.replaces_id = s.id);
  IF cardinality(currents) <> 1 OR currents[1] <> NEW.id THEN
    RAISE EXCEPTION USING ERRCODE = '23505', CONSTRAINT = 'pcmso_signed_current_unique',
      TABLE = 'pcmso_signed_documents', MESSAGE = 'pcmso_signed_current_unique',
      DETAIL = CASE WHEN cardinality(currents) > 2 OR (cardinality(currents) > 1 AND NEW.replaces_id IS NOT NULL) THEN 'ambiguous' ELSE 'current_exists' END;
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.pcmso_signed_current_guard() FROM PUBLIC;
--> statement-breakpoint
DROP TRIGGER IF EXISTS pcmso_signed_current_guard ON public.pcmso_signed_documents;
--> statement-breakpoint
CREATE TRIGGER pcmso_signed_current_guard AFTER INSERT ON public.pcmso_signed_documents
  FOR EACH ROW EXECUTE FUNCTION public.pcmso_signed_current_guard();
