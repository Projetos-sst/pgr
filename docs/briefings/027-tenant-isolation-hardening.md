# Briefing — Fatia 027: Testes de isolamento multi-tenant + CI de integração

**Issue**: #49 · `[Fase 07] 11 · Testes de isolamento multi-tenant`
**Branch**: `feature/027-tenant-isolation-hardening` (base: `develop`)
**Data**: 2026-07-14

## 1. A task

Validar o isolamento multi-tenant (Princípio I) — nenhum dado de uma organização acessível por outra —
nas duas barreiras (app + RLS), com testes automatizados do caminho crítico.

## 2. Achado central (crítico)

**A suíte de integração NUNCA rodou de verdade.** O `ci.yml` executava `test:integration`, mas **sem
`INTEGRATION_DATABASE_URL`** — e o harness auto-pula (`describe.skip`) quando a env falta. Ou seja: os
testes de isolamento/RLS existiam mas **jamais foram executados** (nem em CI, nem localmente). Este é o
gap que o Doug apontou ("testa minimamente antes de subir").

## 3. O que foi feito

### Auditoria de RLS

Toda tabela de negócio (com `org_id`) tem `.enableRLS()` + policy de isolamento (`companies`, `ges`,
`risks`, `pgr`, `epi_*`, `trainings`, `schedule_events`, etc.). Tabelas de identidade
(`users`/`org_memberships`) usam RLS via `auth.jwt()`. **Cobertura completa.**

### CI passa a rodar integração DE VERDADE

- `ci.yml`: adiciona **serviço Postgres 16** ao job de testes + step de **bootstrap** que cria o shim
  "sabor Supabase" (roles `authenticated`/`anon`/`service_role`/`app_runtime` + função `auth.jwt()`
  lendo `request.jwt.claims`) via `scripts/ci-integration-bootstrap.sql`.
- Env correta: `INTEGRATION_DATABASE_URL` = conexão **app_runtime** (RLS ENFORCED),
  `INTEGRATION_DATABASE_URL_ADMIN` = superuser (migrations/seed). `app_runtime` herda `authenticated`
  para as policies das tabelas de identidade valerem — RLS continua enforced (sem BYPASSRLS).
- `test:integration` roda **serial** (`--runInBand`): o seed dá `truncate`+`insert` por suíte; em
  paralelo os workers colidiam (`orgs_pkey` duplicado). Serial resolve.

### Resultado

`npm run test:integration` → **99 suítes / 708 testes verdes** contra Postgres real (inclui `runIsolationSuite`
para toda tabela tenant + as fatias 021/023/025 da Fase 07).

### Suítes excluídas (dívida pré-existente, documentada em `jest.config.ts`)

8 suítes que **nunca rodaram** e não são regressão desta fatia:

- **6 REST-via-Jest** (`rest-*`): os próprios autores documentaram no topo dos arquivos que o harness de
  Route Handler do Next no Jest retorna 500 ("validar por cURL"). A lógica é coberta pelos testes de
  Server Action (verdes) + Postman. Reabilitar = harness de route handler (follow-up).
- **2 de privilégio** (`least-privilege`, `companies-scope-model`): dependem do modelo exato de roles do
  Supabase (`service_role` BYPASSRLS, escopo de `set_config('request.jwt.claims')`) que o Postgres
  vanilla aproxima mas não replica 1:1. O backstop cross-tenant já é coberto por `runIsolationSuite`.

## 4. Rodar integração localmente

```bash
# 1. Postgres local (qualquer): crie o banco e o shim
createdb sst_test
psql -d sst_test -f scripts/ci-integration-bootstrap.sql
# 2. envs (app_runtime = RLS enforced; ADMIN = superuser)
export INTEGRATION_DATABASE_URL=postgresql://app_runtime:app_runtime@localhost:5432/sst_test
export INTEGRATION_DATABASE_URL_ADMIN=postgresql://postgres:postgres@localhost:5432/sst_test
npm run test:integration
```

## 5. Follow-up (não bloqueia)

Issue para reabilitar as 8 suítes: harness de Route Handler p/ os `rest-*` e alinhar
`least-privilege`/`companies-scope-model` ao shim (ou rodar contra branch Supabase real).
