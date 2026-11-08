-- PENDENTE (lote 3, segurança): o integrador anexa este conteúdo ao final da 0081 gerada pelo
-- drizzle-kit, mantendo os separadores `--> statement-breakpoint`. Não é aplicado sozinho.
--
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
