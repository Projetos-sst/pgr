-- Provisionamento dos buckets do Supabase Storage como migration.
--
-- Antes disto os buckets eram criados à mão no painel do Supabase (ver o
-- comentário em `src/shared/integrations/storage/company-logo-storage.ts`).
-- Na prática `company-logos` e `employee-photos` nunca foram criados no projeto
-- de develop/homolog, e o upload de logo (#4) e de foto do funcionário (#16)
-- falhava com "Bucket not found" apesar do código estar correto.
--
-- Trazendo para cá, um banco novo (produção) nasce completo só com
-- `npm run db:migrate`, sem passo manual no painel.
--
-- Guard de ambiente: `storage.buckets` só existe em Postgres com a extensão de
-- Storage do Supabase. A suíte de integração roda em Postgres VANILLA (ver
-- scripts/ci-integration-bootstrap.sql, que faz shim só de `auth`), então lá
-- este bloco é no-op em vez de quebrar a aplicação das migrations.
--
-- Idempotente por `on conflict (id) do nothing` — em banco que já tem o bucket
-- (`documents` em develop), a linha existente é preservada como está.
--
-- Acesso: o app fala com o Storage pela service key
-- (`getRlsBypassingSupabaseClient`), que ignora RLS — por isso nenhum bucket
-- precisa de policy própria, e o `documents` de hoje roda com 0 policies.

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'storage.buckets ausente (Postgres sem Supabase Storage) — pulando provisionamento de buckets';
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES
    -- GED (fatia 024): tipo e tamanho livres, é acervo de documento.
    ('documents', 'documents', false, NULL, NULL),
    -- Logo da empresa (#4): 5 MB = MAX_LOGO_BYTES em domains/pgr/company-logo.ts
    ('company-logos', 'company-logos', false, 5242880, ARRAY['image/png','image/jpeg']),
    -- Foto do funcionário (#16): 5 MB = MAX_PHOTO_BYTES em domains/pgr/employee-photo.ts
    ('employee-photos', 'employee-photos', false, 5242880, ARRAY['image/png','image/jpeg'])
  ON CONFLICT (id) DO NOTHING;
END
$$;
