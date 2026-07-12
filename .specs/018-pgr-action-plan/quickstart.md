# Quickstart — Medidas de controle (5W2H) · validação manual

Validação **local** contra **Postgres efêmero** (nunca Supabase compartilhado; nunca seed
destrutivo em banco de dev). **Não imprimir secrets** (`.env`, `DATABASE_URL`, senhas, tokens).

## 0. Pré-condições

- Branch `feature/pgr-action-plan`, código da fatia implementado.
- Postgres efêmero descartável (Docker) — role `app_runtime` **não-superuser**, RLS real.
- Dev bypass do REST: `APP_ENV != "production"` + `DEV_API_AUTH_BYPASS=true` + headers
  `x-dev-tenant`/`x-dev-role`/`x-dev-user`.

## 1. Subir Postgres efêmero + roles + schema auth

```bash
docker run --name sst-cm-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=sst_test -p 55433:5432 -d postgres:16
# criar roles anon/authenticated/service_role (NOLOGIN) e app_runtime (LOGIN, NÃO superuser),
# schema auth + stubs auth.uid()/role()/jwt()  — igual às fatias 014/016.
```

`INTEGRATION_*` para os testes de integração (Postgres efêmero), por exemplo:

```bash
export INTEGRATION_DATABASE_URL_ADMIN="postgres://postgres:postgres@localhost:55433/sst_test"
export INTEGRATION_APP_RUNTIME_URL="postgres://app_runtime:app_runtime@localhost:55433/sst_test"
```

> Valores acima são de um banco **descartável local** — não são secrets de produção.

## 2. Aplicar migrations + seed PGR (helper de integração)

Usar o helper `src/__tests__/integration/_helpers/db.ts` (`applyMigrations`) + `pgr-seed.ts`
(`seedPgrBase`). O seed já cria: `org_a` (free) / `org_b` (pro), `riskA`@org_a, `riskB`@org_b,
`controlMeasureA`@org_a (`elimination`, `applicable=false`), `controlMeasureB`@org_b (`ppe`,
`applicable=true`), e a avaliação vigente `riskAssessmentA`@org_a (riskLevel 9).

## 3. Testes automatizados

```bash
# Unit (domínio puro: validação condicional + estados derivados)
npx jest --selectProjects unit --runTestsByPath \
  src/__tests__/unit/domains/pgr/control-measure.test.ts

# Integração (Server Actions + RLS + REST) — Postgres efêmero
npm run test:integration -- --runTestsByPath \
  src/__tests__/integration/control-measures/control-measures.test.ts \
  src/__tests__/integration/control-measures/control-measures-isolation.test.ts \
  src/__tests__/integration/control-measures/rest-control-measures.test.ts --runInBand
```

> Se `rest-control-measures.test.ts` falhar com **500** por limitação pré-existente do harness
> REST-via-Jest (provada nas fatias 014/016), **documentar** e validar o REST por **cURL** (§4).
> Actions (13+) + isolamento (6+) provam a lógica.

## 4. Dev server + cURL REST (autoritativo)

```bash
# subir dev server apontando para o Postgres efêmero, com bypass dev (porta alternativa)
DATABASE_URL="postgres://app_runtime:app_runtime@localhost:55433/sst_test" \
APP_ENV=local DEV_API_AUTH_BYPASS=true PORT=3100 npm run dev
```

Headers padrão (tenant/role da sessão vêm daqui — **nunca** do corpo):

```bash
BASE=http://localhost:3100/api/v1
H=(-H "x-dev-tenant: org_a" -H "x-dev-role: owner" -H "x-dev-user: dev" -H "Content-Type: application/json")
RISK=11111111-1111-1111-1111-1111111111c1   # riskA do seed (conferir PGR_IDS)
```

Casos a exercer (esperado ⇒ status):

```bash
# LIST (200)
curl -s "${H[@]}" "$BASE/risks/$RISK/control-measures"

# CREATE nível collective_protection, applicable=true (201; riskLevel/result NÃO existem aqui)
curl -s -X POST "${H[@]}" "$BASE/risks/$RISK/control-measures" -d '{
  "controlLevel":"collective_protection","applicable":true,
  "actionWhat":"Enclausuramento acústico","actionHow":"Projeto + execução",
  "actionResponsible":"Maria Souza","actionDeadline":"2026-09-30"}'

# CREATE mesmo nível de novo (409 DUPLICATE) — UNIQUE (org,risk,control_level)
curl -s -o /dev/null -w "%{http_code}\n" -X POST "${H[@]}" \
  "$BASE/risks/$RISK/control-measures" -d '{"controlLevel":"collective_protection","applicable":false}'

# CREATE applicable=true SEM actionWhat/actionHow (422 VALIDATION, fields)
curl -s -X POST "${H[@]}" "$BASE/risks/$RISK/control-measures" \
  -d '{"controlLevel":"administrative","applicable":true}'

# CREATE em risco de outro tenant / inexistente (422 FK_NOT_FOUND)
curl -s -o /dev/null -w "%{http_code}\n" -X POST "${H[@]}" \
  "$BASE/risks/00000000-0000-0000-0000-000000000000/control-measures" \
  -d '{"controlLevel":"ppe","applicable":false}'

# GET / PUT / DELETE por id da medida criada (200 / 200 / 204)
CM=<id-retornado-no-create>
curl -s "${H[@]}" "$BASE/control-measures/$CM"
curl -s -X PUT "${H[@]}" "$BASE/control-measures/$CM" -d '{
  "controlLevel":"collective_protection","applicable":true,
  "actionWhat":"Enclausuramento (revisado)","actionHow":"Novo fornecedor","actionDeadline":"2026-08-15"}'
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "${H[@]}" "$BASE/control-measures/$CM"

# role client (403 FORBIDDEN)
curl -s -o /dev/null -w "%{http_code}\n" -H "x-dev-tenant: org_a" -H "x-dev-role: client" \
  -H "x-dev-user: dev" "$BASE/risks/$RISK/control-measures"

# medida de outro tenant (404 NOT_FOUND): usar controlMeasureB (org_b) com tenant org_a
curl -s -o /dev/null -w "%{http_code}\n" "${H[@]}" "$BASE/control-measures/<controlMeasureB-id>"
```

Registrar o **tenant usado** (`org_a`) e **apagar a medida de teste** ao final (DELETE acima).

## 5. Playwright MCP (UI) — se houver credencial Clerk

Fluxo em `/risks/[id]/control-measures`:

1. Abrir o detalhe do risco → clicar em **"Medidas de controle"**.
2. Conferir **contexto do risco** (agente/perigo/descrição) e **avaliação vigente**
   (`riskLevel`/classificação) ou **"Sem avaliação vigente"**.
3. **Nova medida**: escolher nível NR-01, marcar `applicable`, preencher `actionWhat`/`actionHow`,
   escolher responsável (combobox de funcionários → grava nome), definir prazo. Salvar.
4. Conferir **estado derivado** na lista (`Planejada`) e o **destaque de vencida** ao usar prazo
   passado (`Vencida`).
5. Tentar criar o **mesmo nível** de novo → erro de duplicidade (409/DUPLICATE).
6. **Editar** (corpo completo) e **excluir** (confirmação). Verificar que o nível volta a ficar
   disponível para novo cadastro.

> Dev bypass cobre **apenas** `/api/v1`; a UI protegida exige credencial Clerk. Sem credencial,
> marcar a validação UI como **bloqueada** (não falha), como nas fatias anteriores.

## 6. Encerramento

```bash
docker rm -f sst-cm-pg   # remover o container efêmero
```

**Nunca** usar Supabase compartilhado para seed destrutivo. **Nunca** imprimir `.env`/secrets.

## Nota de formatação (dívida conhecida)

`CLAUDE.md` falha no `format:check` (dívida conhecida) — **não** corrigir durante plan/tasks. Nos
gates finais: rodar Prettier **dirigido** nos arquivos da feature (devem ficar clean), então
`format:check`; ao falhar, **separar** (a) falhas reais da feature, (b) dívida `CLAUDE.md`, (c)
ruído CRLF pré-existente (CI-LF não acusa). **Não** formatar repo-wide às cegas.
