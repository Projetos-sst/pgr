# Quickstart — Avaliação de Risco (matriz 5×5) · Feature 016

Plano de teste (automatizado + manual) e comandos reais. Integração **sempre** contra **Postgres
efêmero** (`INTEGRATION_*`), **nunca** SQLite nem o Supabase compartilhado com seed destrutivo.

## Gates finais (obrigatórios antes de push/PR)

```bash
npm run lint
npm run typecheck
npm run test                 # unit (jsdom)
npm run test:integration     # integração (node) — requer INTEGRATION_* (ver abaixo)
npm run format:check         # MESMO check do CI (LF/repo-wide) — Prettier dirigido NÃO basta
npm run build
```

> Se `format:check` acusar arquivos da feature (incl. os `.md` desta spec), rodar
> `npx prettier --write <arquivos>` **apenas** neles e revalidar. **Não** formatar repo-wide às cegas
> — analisar o diff (aprendizado do PR #135, em que o CI reprovou `.md` de spec desformatado).

## Testes automatizados

### Unit — `src/__tests__/unit/domains/pgr/risk-assessment.test.ts`

- `probability` 1–5 válido; fora de 1–5 (0, 6) → erro.
- `severity` 1–5 válido; fora de 1–5 → erro.
- `uncertaintyDegree` 0–2 válido; fora de 0–2 (−1, 3) → erro; default 0 quando omitido.
- `criterion` inválido → erro; `qualitative`/`quantitative` válidos.
- `assessedAt` obrigatória; data impossível (`2026-13-45`) → erro; `AAAA-MM-DD` válida aceita.
- coerção string→número (`"3"` → `3`) em probability/severity/uncertainty.
- `computeRiskLevel(p,s) = p*s` (ex.: 3×3=9, 5×5=25).
- `deriveAssessmentResult({probability,severity}, defaultRiskMethodology().classificationBands)` →
  `{ riskLevel, result }` com `result` coerente com a faixa padrão (ex.: nível 9 → classe esperada;
  nível 25 → `intolerable`).

Rodar 1 arquivo: `npx jest --selectProjects unit --runTestsByPath src/__tests__/unit/domains/pgr/risk-assessment.test.ts`

### Integração Actions — `src/__tests__/integration/risk-assessments/risk-assessments.test.ts`

Contra Postgres efêmero, tenant `org_a` (`requireOfficeStaff` mockado/bypass), seed já com
`riskA`/`riskAssessmentA`:

- `list` por risco (retorna a avaliação semeada; paginado).
- `get` por id.
- `getCurrent` retorna a última por `assessedAt desc`, `createdAt desc`; risco sem avaliações → `null`.
- `create` → calcula e **persiste** `riskLevel` (= prob×sev) e **persiste** `result` (classe da
  metodologia padrão).
- `update` (corpo completo) → **recalcula** `riskLevel` e `result`; não altera `risk_id`.
- `delete` físico → some da lista.
- **reavaliação**: 2º `create` no mesmo risco cria **nova linha** (sem 409); `getCurrent` passa a
  refletir a mais recente.
- `riskId` inexistente/cross-tenant (`create`/`list`/`current`) → `FK_NOT_FOUND`.
- avaliação inexistente/cross-tenant (`get`/`update`/`delete`) → `NOT_FOUND`.
- papel `client` → `FORBIDDEN`.
- lista de `org_a` **não** vaza `riskAssessmentB` de `org_b`.

### Integração REST — `src/__tests__/integration/risk-assessments/rest-risk-assessments.test.ts`

GET list, POST create (201), GET by id, PUT update (200), DELETE (204), 403 (`client`), 404
(cross-tenant), 422 (validation), 422 (FK — riskId inválido), **nunca 409**. Via bypass dev
(`APP_ENV != production` + `DEV_API_AUTH_BYPASS=true`, headers `x-dev-*`).

> ⚠️ Se o harness REST-via-Jest falhar com **500** (limitação pré-existente, provada com
> `rest-pgr.test.ts` na fatia `014`), **documentar** no relatório e validar o REST **por cURL** (ver
> abaixo). As Actions + isolamento já provam a lógica de negócio.

### Isolamento — `src/__tests__/integration/risk-assessments/risk-assessments-isolation.test.ts`

`runIsolationSuite({ table: "risk_assessments", seededCountA: 1, crossTenantInsertSql: <insert em
public.risk_assessments com org_b, riskB, criterion 'qualitative', probability 2, severity 4,
risk_level 8> })`. Prova RLS backstop: `org_a` não lê linha de `org_b`; escrita cross-tenant barrada.

## Bootstrap do Postgres efêmero (Docker)

```bash
docker run --name sst-ra-integration-postgres -p 55433:5432 \
  -e POSTGRES_PASSWORD=postgres -d postgres:16
# Papéis Supabase-like + app_runtime (LOGIN, NÃO superuser) + stubs auth.*:
#   anon/authenticated/service_role (NOLOGIN), app_runtime (LOGIN senha 'app_runtime'),
#   schema auth + funções auth.jwt()/uid()/role().
# Aplicar migrations 0000..0014 (helper splita por '--> statement-breakpoint') + pgr-seed.
export INTEGRATION_DATABASE_URL='postgres://postgres:postgres@localhost:55433/postgres'
export INTEGRATION_APP_RUNTIME_URL='postgres://app_runtime:app_runtime@localhost:55433/postgres'
npm run test:integration -- --runInBand
# Ao final:
docker rm -f sst-ra-integration-postgres
```

> `INTEGRATION_DATABASE_URL` (admin) aplica migrations/seed e bypassa RLS; `INTEGRATION_APP_RUNTIME_URL`
> (role `app_runtime`) exerce o RLS real. Nunca apontar para o Supabase compartilhado.

## Validação manual — cURL (REST autoritativo)

Dev server no Postgres efêmero (env de shell sobrepõe `.env`):

```bash
DATABASE_URL='postgres://app_runtime:app_runtime@localhost:55433/postgres' \
APP_ENV=local DEV_API_AUTH_BYPASS=true npm run dev
```

Cabeçalhos de bypass (registrar o tenant usado — ex.: `org_a`):

```bash
H=(-H "x-dev-tenant: org_a" -H "x-dev-role: owner" -H "x-dev-user: dev" -H "Content-Type: application/json")
RISK=<uuid de um risco de org_a>   # ex.: seed riskA
BASE=http://localhost:3000/api/v1

# list (200)
curl -s "${H[@]}" "$BASE/risks/$RISK/assessments"
# create (201) — riskLevel e result devem voltar preenchidos
curl -s -X POST "${H[@]}" "$BASE/risks/$RISK/assessments" \
  -d '{"criterion":"quantitative","probability":3,"severity":3,"uncertaintyDegree":0,"assessedAt":"2026-07-08"}'
AID=<id retornado>
# get (200) / update recalcula (200) / delete (204)
curl -s "${H[@]}" "$BASE/risk-assessments/$AID"
curl -s -X PUT "${H[@]}" "$BASE/risk-assessments/$AID" \
  -d '{"criterion":"quantitative","probability":5,"severity":5,"uncertaintyDegree":1,"assessedAt":"2026-07-08"}'
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "${H[@]}" "$BASE/risk-assessments/$AID"  # 204

# Erros:
curl -s -o /dev/null -w "%{http_code}\n" -X POST "${H[@]}" "$BASE/risks/$RISK/assessments" \
  -d '{"criterion":"quantitative","probability":9,"severity":3,"assessedAt":"2026-07-08"}'   # 422 validation
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/risks/00000000-0000-0000-0000-000000000000/assessments"  # 422 FK
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/risk-assessments/00000000-0000-0000-0000-000000000000"    # 404
curl -s -o /dev/null -w "%{http_code}\n" -H "x-dev-tenant: org_a" -H "x-dev-role: client" \
  "$BASE/risks/$RISK/assessments"   # 403
```

Confirmar: **nenhuma** resposta 409 em qualquer cenário.

## Validação manual — Playwright MCP (UI)

Com credencial Clerk de teste (se ausente, **reportar bloqueio** — não forçar):

1. `/risks/[id]` → clicar em **"Avaliações"** → `/risks/[id]/assessments` (histórico + vigente).
2. **"Nova avaliação"** → escolher probability/severity → conferir **preview em tempo real** de
   `riskLevel` e da classificação (usando a metodologia da org; se `configured:false`, ver aviso de
   fallback) → salvar → aparece no topo do histórico com `result` persistido.
3. Editar a avaliação (corpo completo) → `riskLevel`/`result` recalculados.
4. Criar 2ª avaliação → histórico com 2 linhas, mais recente no topo, marcada como vigente.
5. Excluir com confirmação → some da lista.

## Higiene de dados de teste

- Usar **banco descartável** (container efêmero); remover ao final (`docker rm -f`).
- **Não** rodar seed destrutivo contra Supabase compartilhado.
- Registrar o **tenant** usado (ex.: `org_a`) no relatório.
- Apagar quaisquer avaliações criadas manualmente durante o teste.
