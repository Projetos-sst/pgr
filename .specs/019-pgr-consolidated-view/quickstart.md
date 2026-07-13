# Quickstart — Editor do PGR e visão consolidada · validação manual

Validação **local** contra **Postgres efêmero** (nunca Supabase compartilhado; nunca seed
destrutivo em banco de dev). **Não imprimir secrets** (`.env`, `DATABASE_URL`, senhas, tokens).

## 0. Pré-condições

- Branch `feature/pgr-consolidated-view`, código da fatia implementado.
- Postgres efêmero descartável (Docker) — role `app_runtime` **não-superuser**, RLS real.
- Dev bypass REST: `APP_ENV != "production"` + `DEV_API_AUTH_BYPASS=true` + headers
  `x-dev-tenant`/`x-dev-role`/`x-dev-user`.

## 1. Subir Postgres efêmero + roles + schema auth

```bash
docker run --name sst-pgr-editor-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=sst_test -p 55433:5432 -d postgres:16
# criar roles anon/authenticated/service_role (NOLOGIN) + app_runtime (LOGIN, NÃO superuser) +
# schema auth + stubs auth.uid()/role()/jwt()  — igual às fatias 014/016/018.
```

`INTEGRATION_*` (banco descartável — não são secrets de produção):

```bash
export INTEGRATION_DATABASE_URL="postgres://postgres:postgres@localhost:55433/sst_test"
export INTEGRATION_DATABASE_URL_ADMIN="postgres://postgres:postgres@localhost:55433/sst_test"
export INTEGRATION_APP_RUNTIME_URL="postgres://app_runtime:app_runtime@localhost:55433/sst_test"
```

## 2. Migrations + seed PGR

Via helper `applyMigrations` + `seedPgrBase`. O seed já cria `pgrA`@org_a (empresa/obra), `gesA`
(vinculado a `pgrA` via `pgrGesA`), riscos/avaliações/medidas em `riskA`, revisão `pgrRevisionA`
(nº 1); e `pgrB`/`gesB`@org_b para cross-tenant.

## 3. Testes automatizados

```bash
npx jest --selectProjects unit --runTestsByPath \
  src/__tests__/unit/domains/pgr/pgr-consolidated.test.ts

npm run test:integration -- --runTestsByPath \
  src/__tests__/integration/pgr-editor/pgr-ges.test.ts \
  src/__tests__/integration/pgr-editor/pgr-revisions.test.ts \
  src/__tests__/integration/pgr-editor/pgr-consolidated.test.ts \
  src/__tests__/integration/pgr-editor/rest-pgr-editor.test.ts --runInBand
```

> Se `rest-pgr-editor.test.ts` der **500** por limitação pré-existente do harness REST-via-Jest,
> **documentar** e validar por **cURL** (§4). Actions + isolamento provam a lógica.

## 4. Dev server + cURL REST (autoritativo)

```bash
DATABASE_URL="postgres://app_runtime:app_runtime@localhost:55433/sst_test" \
APP_ENV=local DEV_API_AUTH_BYPASS=true PORT=3100 npm run dev
```

```bash
BASE=http://localhost:3100/api/v1
H=(-H "x-dev-tenant: org_a" -H "x-dev-role: owner" -H "x-dev-user: dev" -H "Content-Type: application/json")
PGR=11111111-1111-1111-1111-1111111111d4   # pgrA (conferir PGR_IDS)
GESA=11111111-1111-1111-1111-1111111111a2  # gesA (já vinculado no seed)
GESB=22222222-2222-2222-2222-2222222222b2  # gesB (org_b → FK_NOT_FOUND)
code(){ curl -s -o /dev/null -w "%{http_code}\n" "$@"; }

# GES-link
code "${H[@]}" "$BASE/pgr/$PGR/ges"                                             # 200 (lista; gesA já vinculado)
code -X POST "${H[@]}" "$BASE/pgr/$PGR/ges" -d "{\"gesId\":\"$GESA\"}"          # 409 DUPLICATE (já vinculado)
code -X POST "${H[@]}" "$BASE/pgr/$PGR/ges" -d "{\"gesId\":\"$GESB\"}"          # 422 FK_NOT_FOUND (org_b)
code -X POST "${H[@]}" "$BASE/pgr/$PGR/ges" -d '{"gesId":"nao-uuid"}'           # 422 VALIDATION
code -X DELETE "${H[@]}" "$BASE/pgr/$PGR/ges/$GESA"                             # 204 (remove vínculo)
code -X POST "${H[@]}" "$BASE/pgr/$PGR/ges" -d "{\"gesId\":\"$GESA\"}"          # 201 (re-vincula)

# Revisões (append-only)
code "${H[@]}" "$BASE/pgr/$PGR/revisions"                                       # 200
code -X POST "${H[@]}" "$BASE/pgr/$PGR/revisions" -d '{"revisionNumber":1,"revisedAt":"2026-07-12"}'  # 409 (nº 1 já existe)
code -X POST "${H[@]}" "$BASE/pgr/$PGR/revisions" -d '{"revisionNumber":2,"revisedAt":"2026-07-12","notes":"Revisão anual"}'  # 201

# Consolidada
code "${H[@]}" "$BASE/pgr/$PGR/consolidated"                                    # 200 (JSON agregado)
curl -s "${H[@]}" "$BASE/pgr/$PGR/consolidated" | head -c 400; echo

# Erros de auth/tenant
code -H "x-dev-tenant: org_a" -H "x-dev-role: client" -H "x-dev-user: dev" -X POST \
  "$BASE/pgr/$PGR/ges" -d "{\"gesId\":\"$GESA\"}"                               # 403 FORBIDDEN
code "${H[@]}" "$BASE/pgr/00000000-0000-0000-0000-000000000000/consolidated"   # 404 (PGR inexistente)
```

Registrar o **tenant usado** (`org_a`) e **desfazer** os dados de teste criados (remover vínculo
extra / a revisão nº 2, se desejado) ao final.

## 5. Playwright MCP (UI) — se houver credencial Clerk

Em `/pgr/[id]`:

1. Confirmar o **editor com abas**: Informações básicas, GES, Revisões, Consolidada (e Cor/Sumário +
   Documentos GED **desabilitadas** com aviso "Fase 05").
2. Aba **GES**: vincular um GES da org, ver na lista; tentar vincular o mesmo → erro de duplicidade;
   remover (com confirmação).
3. Aba **Revisões**: criar revisão (nº/data/notas); tentar nº repetido → erro; conferir lista.
4. Aba **Consolidada**: conferir dados do PGR, GES vinculados, riscos **ordenados por nível desc**,
   avaliação vigente, medidas com **estado derivado**; e os fallbacks (sem GES / sem risco / sem
   avaliação / sem medidas).

> Dev bypass cobre **apenas** `/api/v1`; a UI protegida exige credencial Clerk. Sem credencial,
> marcar a validação UI como **bloqueada** (não falha).

## 6. Encerramento

```bash
docker rm -f sst-pgr-editor-pg
```

**Nunca** usar Supabase compartilhado para seed destrutivo. **Nunca** imprimir `.env`/secrets.

## Nota de formatação

Nos gates finais: Prettier **dirigido** nos arquivos da feature (devem ficar clean), então
`format:check`; ao falhar, **separar** (a) falhas reais da feature, (b) ruído CRLF pré-existente
(CI-LF não acusa), (c) arquivos fora do escopo. **Não** formatar repo-wide às cegas.
