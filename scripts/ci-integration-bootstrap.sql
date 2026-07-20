-- Bootstrap de um Postgres VANILLA para rodar a suíte de integração.
-- O harness (src/__tests__/integration/_helpers) espera um Postgres "sabor Supabase":
-- roles authenticated/anon/service_role/app_runtime + função auth.jwt() lendo os
-- claims de request.jwt.claims. Este script cria esse shim de forma idempotente.
-- Uso (rodar conectado ao BANCO de teste, ex.: sst_test):
--   psql -h localhost -U postgres -d sst_test -f scripts/ci-integration-bootstrap.sql
-- Depois exporte (mesma cabeação do ci.yml):
--   INTEGRATION_DATABASE_URL=postgresql://app_runtime:app_runtime@localhost:5432/sst_test        -- app_runtime: RLS ENFORCED (least-privilege). É a conexão que `appRuntimeClient()` usa.
--   INTEGRATION_DATABASE_URL_ADMIN=postgresql://postgres:postgres@localhost:5432/sst_test         -- superuser: migrations + seed (bypassa RLS). Usado por `adminClient()`.
--   INTEGRATION_APP_RUNTIME_URL=postgresql://app_runtime:app_runtime@localhost:5432/sst_test
-- ATENÇÃO: NÃO aponte INTEGRATION_DATABASE_URL para o superuser `postgres` — o superuser
-- IGNORA RLS, e os testes de backstop de isolamento passam a "enxergar" tudo (falso-positivo/negativo).

-- Roles são globais no cluster; criadas idempotentemente.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime LOGIN PASSWORD 'app_runtime';
  END IF;
END
$$;

-- app_runtime herda `authenticated` para que as policies `TO authenticated`
-- das tabelas de identidade (users/orgs/org_memberships, estilo auth.jwt())
-- se apliquem à conexão de runtime — como no Supabase. RLS continua ENFORCED
-- (app_runtime não é superuser nem BYPASSRLS).
GRANT authenticated TO app_runtime;
GRANT anon TO app_runtime;

GRANT CONNECT ON DATABASE sst_test TO app_runtime;

-- Shim do schema/função auth do Supabase (por banco).
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO app_runtime, authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $fn$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$fn$;
