# Implementation Plan: Modelo de dados do módulo de EPIs

**Branch**: `feature/epi-data-model` | **Date**: 2026-06-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/008-epi-data-model/spec.md`

## Summary

Modelar e migrar as 6 tabelas-base do módulo de EPIs (`epi_catalog`, `epi_stock`,
`stock_movements`, `epi_deliveries`, `epi_delivery_items`, `epi_risk`), isoladas por tenant
(Modelo B), reusando a taxonomia `categories` (006) e vinculando `epi_risk` ao `ges` de forma
interina. É uma fatia de **modelagem de dados pura** (schema Drizzle code-first + migration
drizzle-kit + RLS + testes), análoga à 006 — sem UI, Server Actions ou CRUD.

**Abordagem técnica**: réplica fiel do padrão das tabelas de `006` (PK uuid, `org_id` indexado
→ `orgs.id`, timestamps + trigger `set_updated_at`, RLS `app_runtime` com GUC `app.current_org`,
GRANT). Constraints no banco como fonte de verdade (CHECK de quantidade/saldo, UNIQUE de
estoque/risco/token, enums fechados, ON DELETE CASCADE/SET NULL/RESTRICT). As clarificações da
sessão 2026-06-22 acrescentam: **(FR-002a)** consistência de tipo item↔categoria via **FK
composta** `(category_id, type) → categories(id, type)`; **(FR-001)** `unit_of_measure` como
texto livre; **(FR-008)** `auth_token` único **global** (índice parcial).

> **Estado atual**: a maior parte do schema/migration/testes **já está implementada** na branch
> (ver [research.md](./research.md) §"As-built"). O delta de trabalho desta fatia é o **FR-002a**
> (FK composta de consistência de tipo) — ainda não presente no código.

## Technical Context

**Language/Version**: TypeScript `strict` (Next.js 16.2.6 / React 19.2.4; runtime Node serverless na Vercel)

**Primary Dependencies**: Drizzle ORM 0.45.2 + drizzle-kit 0.31.10; `postgres` 3.4.9; zod 4.4.3

**Storage**: Supabase PostgreSQL. Runtime conecta como `app_runtime` (pooler 6543); `drizzle-kit` aplica migration via conexão direta unpooled (owner)

**Testing**: Jest + Testing Library (unit); integração contra **Postgres efêmero** (`INTEGRATION_*`) para RLS/constraints — **nunca SQLite** (Constituição §Quality Gates, exceção PostgreSQL)

**Target Platform**: Vercel serverless + Supabase gerenciado

**Project Type**: Web app fullstack Next.js (App Router); esta fatia toca apenas a camada de dados (`src/shared/db/`)

**Performance Goals**: N/A (modelagem). Índices em todas as FKs e em `org_id` para suportar as leituras da Fase 2

**Constraints**: Isolamento multi-tenant não-negociável (Princípio I); banco é fonte de verdade (Princípio V); sem nova infraestrutura (Princípio II)

**Scale/Scope**: 6 tabelas novas + 2 enums novos + 1 alteração aditiva em `categories` (UNIQUE `(id, type)`); 1 migration (`0007_epi_data_model`)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio                          | Avaliação                                                                                                                                                                                                                                                                                                                                      | Status  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| I — Isolamento Multi-Tenant        | Toda tabela tem `org_id NOT NULL → orgs.id` indexado + RLS `app_runtime` com `current_setting('app.current_org')` em USING/WITH CHECK; acesso via `withOrg`; tenant da sessão, nunca do cliente. `auth_token` único global **não** vaza dados entre tenants (RLS continua barrando leitura cross-tenant; o índice só impede colisão de token). | ✅ PASS |
| II — Stack Fixa / YAGNI            | Sem nova infra; só schema + migration. Nenhuma abstração especulativa.                                                                                                                                                                                                                                                                         | ✅ PASS |
| III — Fatias Verticais             | Fatia de dados independente e testável isoladamente (espelha 006).                                                                                                                                                                                                                                                                             | ✅ PASS |
| IV — Operações Pesadas Assíncronas | N/A — não há operação pesada nesta fatia.                                                                                                                                                                                                                                                                                                      | ✅ PASS |
| V — Segurança e Integridade        | Constraints no banco (FK, NOT NULL, UNIQUE, CHECK, enums) como fonte de verdade; validação zod complementar; TS strict. FR-002a **reforça** a integridade (consistência de tipo no banco).                                                                                                                                                     | ✅ PASS |

**Resultado**: nenhuma violação. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
.specs/008-epi-data-model/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões/justificativas + as-built
├── data-model.md        # Phase 1 — entidades, campos, relações, constraints
├── quickstart.md        # Phase 1 — guia de validação (migration + testes)
├── contracts/
│   └── schema-and-migrations.md   # Contrato do schema/migration/RLS
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/shared/db/
├── schema/
│   ├── epis.ts                 # 6 tabelas + 2 enums (epi_data_model)  [as-built]
│   ├── categories.ts           # + UNIQUE(id, type) p/ FK composta     [delta FR-002a]
│   └── index.ts                # exporta tabelas/enums/tipos de epis    [as-built]
└── migrations/
    ├── 0007_epi_data_model.sql # CREATE TYPE/TABLE/POLICY + GRANT + triggers [as-built]
    └── meta/                   # snapshot/journal drizzle-kit               [as-built]

src/shared/domains/pgr/
└── validation.ts               # stockMovementTypeSchema / epiSignatureStatusSchema / epiQuantitySchema [as-built]

src/__tests__/
├── unit/domains/pgr/epi-validation.test.ts
└── integration/
    ├── _helpers/pgr-seed.ts    # seed da cadeia EPI por tenant
    └── shared/db/
        ├── epi-constraints.test.ts
        ├── epi-migration-shape.test.ts
        └── *-isolation.test.ts # 6 suítes (uma por tabela)
```

**Structure Decision**: layout idêntico ao da 006 — schema em `src/shared/db/schema/`, migration
em `src/shared/db/migrations/`, validação em `src/shared/domains/pgr/`, testes em
`src/__tests__/`. Nenhuma pasta nova; a fatia é confinada à camada de dados.

## Complexity Tracking

> Sem violações da constituição — seção intencionalmente vazia.
