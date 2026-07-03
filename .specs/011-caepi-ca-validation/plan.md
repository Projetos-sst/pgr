# Implementation Plan: Validação/consulta de CA no CAEPI/MTE (base local + `lookupCa`)

**Branch**: `feature/external-integrations-layer` | **Date**: 2026-07-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/011-caepi-ca-validation/spec.md`

## Summary

Entregar a **validação/consulta local de CA** para o cadastro de EPI (issues #115/#75): uma tabela
**global** `caepi_certificates` (espelho da base pública do MTE, **sem tenant** — exceção
justificada ao Princípio I), alimentada por um **job de ingestão** (`scripts/caepi-sync.ts`:
coleta com browser real → parse de CSV em streaming → upsert idempotente por `ca`), e a consulta
`lookupCa` (Server Action session-gated + REST `GET /api/integrations/caepi/[ca]`) que devolve o
contrato fechado `CaLookupResult` (`valid` | `expired` | `not_found`) e autopreenche fabricante,
norma e validade no formulário de EPI — **sem nunca bloquear** o cadastro.

Abordagem técnica: a fatia estende a **camada de integrações** (CEP/CNPJ, já nesta branch) com o
vertical `src/shared/integrations/caepi/**`. A consulta é 100% local: `normalize` (só dígitos) →
`repositories/caepi.getByCa` (SELECT por PK, sem `withOrg` — tabela global) → `validate-ca` (pura:
`valid` se situação "VÁLIDO" e `valid_until >= hoje`; senão `expired`) → `CaLookupResult`. O REST
segue o molde `_lib/respond.ts` (`ensureSession`/`invalidFormat`), mas devolve os **3 estados como
payload 200** (clarificado); o hook `use-caepi-validation` **reusa `useLookup`** (fetch + abort)
apontando para o REST, e o `ca-field.tsx` fica colocado no client da integração (plugável no form
de EPI da #18). A ingestão decopla coleta de ingestão pelo arquivo `.csv.gz`: `collect.ts` é o
único passo com browser (**Playwright**/Chromium: Cloudflare + postback ASP.NET); `parse.ts` é
puro e em streaming (`zlib.createGunzip()` + **`csv-parse`**: `;`, aspas/escape `""`, BOM, 19
colunas, Zod por linha, descarte com log); `upsertMany` grava em chunks com `onConflictDoUpdate`
por `ca`, via **conexão owner/unpooled injetada** (o runtime `app_runtime` só tem SELECT). O
fallback semi-manual é o mesmo script com `--file <caminho.csv.gz>` (pula só a coleta). **1
migration nova (`0009`)** com GRANT SELECT-only + trigger `set_updated_at`.

## Technical Context

**Language/Version**: TypeScript `strict` (Next.js 16.2.6 App Router, React 19.2.4); script de job
executado com `tsx` (já devDependency).

**Primary Dependencies**: Drizzle ORM (`postgres` driver), zod 4, Clerk (`@clerk/nextjs`).
**2 devDependencies novas, usadas SÓ pelo job** (nunca no runtime da app/Vercel): **`playwright`**
(Chromium real para a coleta — Cloudflare bloqueia clientes não-browser, fato do Spike 0) e
**`csv-parse`** (parser CSV maduro em streaming — a spec proíbe parse manual). Justificativas em
Complexity Tracking.

**Storage**: Supabase PostgreSQL. Nova tabela **global** `caepi_certificates` (sem `org_id`, sem
policy de tenant, `ca` como PK natural) via migration **`0009`** (drizzle-kit) com SQL custom:
`GRANT SELECT` (e somente SELECT) a `app_runtime` + trigger `set_updated_at` (padrão `0001`/`0005`/
`0007`). A `0006` já revoga privilégios default de `anon`/`authenticated` em tabelas futuras — a
tabela nova nasce fechada para a Data API. Escrita só por conexão owner (`DATABASE_URL_UNPOOLED`).

**Testing**: Jest projetos `unit` e `integration`. Unit: `parse` (amostra real de CSV como
fixture, incl. `.csv.gz`), `validate-ca`, `normalize`, mapeamento → `CaLookupResult`. Integração
contra **Postgres efêmero** (`INTEGRATION_DATABASE_URL` app_runtime + `INTEGRATION_DATABASE_URL_ADMIN`
owner, harness `_helpers/db.ts`): upsert idempotente, `getByCa` 3 estados, **GRANT SELECT-only
comprovado por papel**, guarda de sessão. Exceção constitucional de Postgres efêmero aplica-se
(GRANT por papel e `onConflictDoUpdate` não existem no SQLite).

**Target Platform**: App na Vercel (consulta: Server Action + Route Handler). O **job roda fora
da Vercel** (Chromium não roda em serverless): script agnóstico ao agendador; recomendação
registrada = GitHub Actions cron semanal com `DATABASE_URL_UNPOOLED` como secret. Onde o job mora
é decisão de infra do time (Out of Scope da spec).

**Project Type**: Web app fullstack (Next.js App Router) + **script batch** de ingestão.

**Performance Goals**: Consulta = 1 SELECT por PK (ms), sem chamada externa (Inv-1). Ingestão =
base nacional (centenas de milhares de linhas): gunzip + CSV + validação em **streaming** (memória
constante) e upsert em **chunks** (~1.000 linhas/lote), idempotente.

**Constraints**: Exceção de tenant **contida** à tabela global (`app_runtime` SELECT-only; escrita
só pelo job com conexão owner); consulta **nunca** bloqueia o cadastro (todo desfecho é aviso);
job **fail-safe** (falha de coleta/gzip → loga alto e sai, base anterior preservada — sem
truncate); modelo de EPI (`epis.ts`) **intacto**; sem Route Handler de cron/`CRON_SECRET`.

**Scale/Scope**: 1 tabela global + 1 migration; 1 script de job; vertical de integração
(collect/parse/normalize/validate/lookup/types); 1 Server Action + 1 endpoint REST + hook + 1
componente de campo; docs (api-design + Postman) e suítes unit/integration.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio                                    | Status                           | Como o plano atende                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I — Isolamento Multi-Tenant (NÃO-NEGOCIÁVEL) | ✅ PASS (exceção documentada)    | `caepi_certificates` **não é dado de negócio de cliente** — é espelho de dado público do MTE, idêntico para todos os tenants; não há cruzamento a proteger. A exceção (sem `org_id`/RLS de tenant/`withOrg`) é **contida e compensada**: `app_runtime` recebe **apenas SELECT**; escrita só pelo job via conexão owner; nenhuma outra tabela do módulo perde isolamento; teste de integração prova o GRANT por papel. Registrada em Complexity Tracking.                                         |
| II — Stack Fixa & Simplicidade (YAGNI)       | ✅ PASS (2 devDeps justificadas) | Sem nova infraestrutura de runtime (nada de fila/microserviço/serviço pago; o job é um script + agendador a cargo do time). `playwright` e `csv-parse` são devDependencies exigidas por fatos provados (Cloudflare só aceita browser real; CSV com aspas/quebras internas exige parser de verdade) — ver Complexity Tracking. Reuso integral da camada de integrações, do envelope `ActionResult` e do harness de testes. Upsert idempotente (sem diff/versionamento — YAGNI); só as colunas D8. |
| III — Entrega em Fatias Verticais            | ✅ PASS                          | Fatia vertical independente: US1 (consulta+autofill) é o valor; US2 (ingestão) é o pré-requisito entregável e testável isolado (fixture `.csv.gz`); US3 (segurança do GRANT) e US4 (REST) são incrementos verificáveis. Não depende da #18 (campo plugável) nem altera 008.                                                                                                                                                                                                                      |
| IV — Operações Pesadas Assíncronas           | ✅ PASS                          | O trabalho pesado (download da base nacional + parse + upsert) roda **fora do caminho do request** por definição (script agendado). No request do usuário só há 1 SELECT local por PK. É a materialização do princípio — o desenho existe exatamente para tirar a fonte externa do caminho do usuário.                                                                                                                                                                                           |
| V — Segurança e Integridade de Dados         | ✅ PASS                          | TS `strict`, sem `any` (linhas do CSV validadas por Zod; `unknown` na fronteira). Entrada validada antes do banco nas duas surfaces (`VALIDATION` 422 sem tocar a base). Postgres como fonte de verdade: `ca` PK, `valid_until date NOT NULL`, `situation NOT NULL`, GRANT por papel. Segredos (`DATABASE_URL_UNPOOLED`) só em env/secret do runner — nunca commitados.                                                                                                                          |

**Gate de testes (Fluxo/Quality Gates)**: a fatia depende de GRANT por papel e
`onConflictDoUpdate` ⇒ integração em **Postgres efêmero** (exceção explícita da constituição),
nunca SQLite nem banco de dev. `npm run check` (format+lint+types+unit) + `npm run
test:integration` MUST passar antes de concluir. Casos críticos validados à mão: exceção de
tenant, GRANT SELECT-only, parsing do CSV real (spec, Definição de pronto).

**Resultado**: PASS. As três entradas de Complexity Tracking são justificativas registradas (uma
exceção de princípio prevista pela própria spec/constituição + duas devDependencies), não
violações abertas.

## Project Structure

### Documentation (this feature)

```text
.specs/011-caepi-ca-validation/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões técnicas (parser, browser, conexões, datas, wrapper)
├── data-model.md        # Phase 1 — caepi_certificates + DTOs + mapa CSV→coluna + derivação de estado
├── quickstart.md        # Phase 1 — migration, bootstrap do job, fallback --file, testes, cURL
├── contracts/           # Phase 1 — contratos
│   ├── ingestion-pipeline.md   # collect/parse/upsertMany/script (CLI + fail-safe)
│   ├── repositories.md         # getByCa + upsertMany (assinaturas e garantias)
│   └── lookup-surfaces.md      # Server Action lookupCa + REST + hook + ca-field
├── checklists/
│   └── requirements.md  # (gerado no /speckit-specify)
└── tasks.md             # Phase 2 — gerado pelo /speckit-tasks (NÃO por este comando)
```

### Source Code (repository root)

```text
src/
├── app/api/integrations/
│   └── caepi/[ca]/route.ts                 # NOVO — GET session-guarded (molde cep/cnpj); 3 estados como payload 200
├── shared/integrations/caepi/
│   ├── types.ts                            # NOVO — CaLookupResult, CaepiParsedRow
│   ├── normalize.ts                        # NOVO — normalizeCa/isValidCa (reusa onlyDigits de ../validation.ts)
│   ├── validate-ca.ts                      # NOVO — puro: (record, today) → "valid" | "expired"
│   ├── lookup.ts                           # NOVO — lookupCaRecord(ca): getByCa + validate → CaLookupResult (serviço único p/ SA e REST)
│   ├── parse.ts                            # NOVO — puro: stream gzip → csv-parse → Zod por linha → CaepiParsedRow (descarta com log)
│   ├── collect.ts                          # NOVO — Playwright/Chromium: Cloudflare + postback ASP.NET → caminho do .csv.gz
│   └── client/
│       ├── use-caepi-validation.ts         # NOVO — hook sobre useLookup (REST caepi); estados idle/loading/valid/expired/not_found/error
│       └── ca-field.tsx                    # NOVO — campo CA + badge/avisos + autofill (plugável no form de EPI da #18)
├── shared/server/actions/epi/
│   └── lookup-ca.ts                        # NOVO — Server Action lookupCa: requireAuth + toActionError → ActionResult<CaLookupResult>
├── shared/db/
│   ├── schema/caepi-certificates.ts        # NOVO — tabela GLOBAL (sem org_id/policy; comentário da exceção) + export no schema/index.ts
│   ├── repositories/caepi.ts               # NOVO — getByCa(ca) (runtime, via db singleton)
│   ├── repositories/caepi-upsert.ts        # NOVO — upsertMany(dbHandle, rows, syncedAt) SEM import de server-only (handle injetado)
│   └── migrations/0009_caepi_certificates.sql  # NOVO — gerada (drizzle-kit) + SQL custom: GRANT SELECT-only + trigger set_updated_at
├── __tests__/
│   ├── unit/integrations/caepi/
│   │   ├── parse.test.ts                   # NOVO — amostra real: aspas c/ ";" e \n, BOM, acentos, linha corrompida, data inválida
│   │   ├── validate-ca.test.ts             # NOVO — limite == hoje → valid; situação vencida/cancelada → expired
│   │   ├── normalize.test.ts               # NOVO — máscara/espaços → dígitos; formatos inválidos
│   │   ├── lookup.test.ts                  # NOVO — mapeamento → CaLookupResult nos 3 estados (repo mockado)
│   │   └── use-caepi-validation.test.tsx   # NOVO — derivação de estados do payload; abort/erro silencioso herdados (fetch mockado)
│   └── integration/
│       ├── _fixtures/caepi-sample.csv.gz   # NOVO — amostra real reduzida (também usada no unit de parse)
│       └── integrations/caepi.test.ts      # NOVO — upsert idempotente (2×); getByCa 3 estados; GRANT (app_runtime SELECT ok, escrita negada); coleta falha → base preservada
scripts/
└── caepi-sync.ts                           # NOVO — job: collect → parse → upsertMany; aceita --file <caminho.csv.gz> (fallback semi-manual); falha alto e sai sem tocar a base
docs/api/
├── api-design.md                           # ESTENDER — CAEPI na seção "Integrações externas" (Recursos/Sumário)
└── sst-manager.postman_collection.json     # ESTENDER — folder CAEPI (molde CEP/CNPJ)
```

**Structure Decision**: CAEPI entra como vertical da **camada de integrações** já existente
(`src/shared/integrations/**` + `src/app/api/integrations/**`), copiando os moldes de CEP/CNPJ
(`validation.ts`/`use-lookup`/`_lib/respond.ts`) — com duas diferenças estruturais decididas em
research: (1) o "provider" do CAEPI é a **base local**, não um fetch externo por request — por isso
não há `providers/caepi.ts` nem uso de `http.ts`/`TtlCache` (o Postgres local já é o cache); (2) o
repositório é **dividido por contexto de execução** (`caepi.ts` leitura runtime vs
`caepi-upsert.ts` escrita do job com handle injetado), porque o script `tsx` não pode importar o
singleton `db` (guard `server-only`). O `ca-field.tsx` fica colocado no `client/` da integração —
a fatia não depende do vertical de UI do catálogo (#18), que ainda não existe nesta branch.

## Complexity Tracking

> Justificativas registradas (aprovadas em spec/Clarifications) — nenhuma violação aberta.

| Desvio                                                            | Por que é necessário                                                                                                                                                            | Alternativa mais simples rejeitada porque                                                                                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tabela global sem `org_id`/RLS de tenant (exceção ao Princípio I) | Dado **público** do MTE, idêntico para todos os tenants; não há dado de cliente nem cruzamento a proteger. Compensação: `app_runtime` SELECT-only; escrita só pelo job (owner). | Replicar por tenant duplicaria a base nacional N vezes sem nenhum ganho de segurança e quebraria a idempotência simples do upsert por `ca`.                                   |
| devDependency nova `playwright` (Chromium na coleta)              | Fato do Spike 0: Cloudflare com desafio JS devolve 403 a qualquer cliente não-browser; o download exige postback ASP.NET com `__VIEWSTATE` real.                                | `fetch`/`undici`/`curl` **provadamente não passam** (mesmo bloqueio que quebrou o proxy do ePGR); engenharia reversa de `cf_clearance` foi descartada por frágil e desonesta. |
| devDependency nova `csv-parse` (parser CSV streaming)             | O CSV real tem `;` e quebras de linha DENTRO de aspas com escape `""` + BOM; a spec (FR-031) proíbe parse manual; a base é grande (streaming).                                  | `split(";")`/regex quebram nos campos com `;`/`\n` internos (corrompem a base); escrever um parser CSV próprio é reinventar roda madura (DRY).                                |
