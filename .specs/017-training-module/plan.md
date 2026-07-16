# Implementation Plan: Módulo de Treinamentos (Fase 04)

**Branch**: `feature/training-module` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/017-training-module/spec.md`

## Summary

Fechar toda a Fase 04 (módulo de treinamentos) numa única leva, sobre o `develop` atual (última
migration `0014`). A leva entrega: uma **Fundação** (migration `0016` com 3 tabelas + 1 enum + 2 funções
puras — `computeValidUntil` e `classifyTrainingStatus`) e quatro histórias "zero migration" construídas
sobre ela — CRUD do catálogo (US1), registro de realização com validade automática (US2), controle de
vencimento/reciclagem (US3) e obrigatórios por função + conformidade (US4). Abordagem técnica: replicar
1:1 os padrões já mergeados (companies/EPI) — camadas `actions → domains → repositories → schema`,
isolamento por `withOrg` + RLS `pgPolicy`, escrita via `auditedTenantWrite`, superfície de API completa
(Server Action + REST mirror + api-design.md + Postman) por recurso, testes unit + integração contra
Postgres efêmero. **Nenhum código de erro novo; nenhuma migration além da `0016`.**

## Technical Context

**Language/Version**: TypeScript `strict` (Next.js 16.2.6 App Router, React 19.2.4)

**Primary Dependencies**: Drizzle ORM + `postgres` (postgres-js) sobre Supabase Postgres · Clerk (auth)
· Zod v4 (validação) · Jest (unit jsdom / integração node)

**Storage**: Supabase PostgreSQL. Migration nova **`0016_training_module`** (drizzle-kit + SQL custom
para GRANT/trigger/policy, aplicada via conexão direta owner `DATABASE_URL_UNPOOLED`). Runtime conecta
como `app_runtime` pelo pooler (6543).

**Testing**: `npm run test` (unit) · `npm run test:integration` (Postgres efêmero `INTEGRATION_*` — RLS
exige Postgres real, nunca SQLite). Gate: `npm run check`.

**Target Platform**: Vercel serverless (Server Actions + Route Handlers unificados no Next.js).

**Project Type**: Web application fullstack Next.js (backend e frontend unificados).

**Performance Goals**: CRUD/queries síncronos (operações rápidas). Sem operação pesada nesta fatia — não
há geração de PDF em lote, cron ou notificação (D7). Listas paginadas (offset, pageSize 20).

**Constraints**: Isolamento multi-tenant não-negociável (`withOrg` + RLS backstop; tenant da sessão,
nunca do cliente). Validade e status calculados **date-only** no fuso `America/Sao_Paulo`, inclusivos.
`valid_until` persistido (não derivado na leitura). Escrita simples auditada (sem transação multi-tabela).

**Scale/Scope**: 3 tabelas novas + 1 enum; 3 recursos de API; 2 funções puras compartilhadas; 1 helper
de repositório (último-registro, window function). Fundação + 4 histórias priorizadas.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Constituição v1.2.1. Avaliação por princípio:

- **I — Isolamento Multi-Tenant (NÃO-NEGOCIÁVEL)**: ✅ As 3 tabelas têm `org_id text NOT NULL → orgs.id`,
  RLS `pgPolicy(...).enableRLS()` para `app_runtime` (`org_id = current_setting('app.current_org',
true)`), e todo acesso passa por `withOrg` com tenant de `requireTenantContext()`. Nenhuma query sem
  filtro de tenant; RLS é backstop. Consultas de conformidade/vencimento também dentro de `withOrg`.
- **II — Stack Fixa e Simplicidade (YAGNI)**: ✅ Nenhuma infra nova. Reuso integral dos padrões
  existentes. Certificado = `certificate_path text` (sem GED/upload — D4). Sem cron/notificação (D7).
  Escrita simples, sem `FOR UPDATE`/transação composta (não há saldo materializado — KISS).
- **III — Entrega em Fatias Verticais**: ✅ Fundação + US1–US4 independentes e testáveis isoladamente;
  ordem P1→P2 com MVP (US1) funcional antes das seguintes. Spec enxuto, uma fatia.
- **IV — Operações Pesadas São Assíncronas**: ✅ Não se aplica — todas as operações são CRUD/leitura
  rápidas. A query de resumo (US3) é uma contagem escopada, não um job.
- **V — Segurança e Integridade de Dados**: ✅ `strict` sem `any`; toda Server Action/Route Handler
  valida com Zod antes de tocar o banco; constraints no Postgres refletem as regras (CHECK
  `workload_hours > 0`, UNIQUE `(org_id,name)` e `(org_id,job_role_id,training_id)`, FKs com
  ON DELETE CASCADE/RESTRICT). Segredos só em env.

**Nota sobre testes de integração (Princípio V / cláusula de Integração v1.2.0)**: a fatia depende de
RLS/policies, logo usa **Postgres efêmero** obrigatoriamente (exceção justificada ao default SQLite —
alinhada ao Princípio I). Sem violações. **Constitution Check: PASS.**

## Project Structure

### Documentation (this feature)

```text
.specs/017-training-module/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 (decisões D1–D7 consolidadas)
├── data-model.md        # Phase 1 (3 tabelas + enum + funções puras)
├── quickstart.md        # Phase 1 (como rodar/testar a fatia)
├── contracts/
│   ├── server-actions.md   # Contratos das Server Actions (officeAction → ActionResult)
│   └── rest-api.md         # Contratos REST (restHandler; verbos, status, erros)
├── checklists/
│   └── requirements.md     # (do /speckit-specify)
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── db/
│   │   ├── schema/
│   │   │   ├── trainings.ts                 # NOVO — enum training_periodicity + 3 tabelas
│   │   │   └── index.ts                      # EDIT — reexport das novas tabelas
│   │   ├── migrations/
│   │   │   └── 0016_training_module.sql      # NOVO — enum+tabelas+FK+CHECK+UNIQUE+GRANT+trigger+policy
│   │   └── repositories/
│   │       ├── training-catalog.ts           # NOVO — list/getById/create/update/delete/countDependents
│   │       ├── training-records.ts           # NOVO — list(byEmployee)/getById/create/delete
│   │       ├── job-role-required-trainings.ts # NOVO — list(byJobRole)/add(idempotente)/delete
│   │       └── training-compliance.ts         # NOVO — helper D5 (último-registro) + vencimento + conformidade + resumo
│   ├── domains/pgr/
│   │   └── trainings.ts                       # NOVO — D1 computeValidUntil, D2 classifyTrainingStatus, zod schemas, labels PT
│   └── server/actions/pgr/
│       ├── training-catalog.ts                # NOVO — Server Actions (officeAction)
│       ├── training-records.ts                # NOVO
│       └── job-role-required-trainings.ts     # NOVO
└── app/
    ├── (protected)/
    │   ├── training-catalog/**                # NOVO — páginas CRUD (molde _ui/{list,form})
    │   └── employees/[id]/**                  # EDIT — registro (US2), vencimento (US3), aba obrigatórios (US4)
    └── api/v1/
        ├── training-catalog/**                # NOVO — GET/POST · [id] GET/PUT/DELETE · [id]/dependents GET
        ├── training-records/**                # NOVO — GET/POST · [id] GET/DELETE
        └── job-role-required-trainings/**     # NOVO — GET/POST · [id] DELETE

src/__tests__/
├── unit/                                      # NOVO — computeValidUntil, classifyTrainingStatus, zod
└── integration/                               # NOVO — CRUD, RLS/cross-tenant, dependents, conformidade

docs/api/
├── api-design.md                              # EDIT — recursos/verbos/filtros dos 3 recursos
└── sst-manager.postman_collection.json        # EDIT — 3 pastas novas
```

**Structure Decision**: Web application fullstack Next.js já estabelecida. A feature adiciona 1 módulo
de schema (`trainings.ts`), 1 módulo de domínio (`domains/pgr/trainings.ts`) com as 2 funções puras + os
schemas Zod, 4 repositórios, 3 grupos de Server Actions, 3 grupos de Route Handlers REST e as telas sob
`(protected)`. Segue exatamente a topologia de `companies`/EPI — sem novas camadas nem pastas de padrão.

## Complexity Tracking

> Sem violações de constituição. Nenhuma justificativa necessária.
