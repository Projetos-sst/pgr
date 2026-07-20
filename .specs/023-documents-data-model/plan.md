# Implementation Plan: Modelo de dados — Documentos, Pastas e Jobs

**Branch**: `feature/documents-data-model` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/023-documents-data-model/spec.md`

## Summary

Modelar e migrar as 3 tabelas de fundação da Fase 05 (`folders`, `documents`, `jobs`) + 3 enums
(`document_status`, `job_type`, `job_status`), isoladas por tenant (Modelo B), como fatia de
**modelagem de dados pura** (schema Drizzle code-first + migration drizzle-kit `0025` + RLS +
testes), análoga às fatias 006/008 — sem UI, sem CRUD.

**Abordagem técnica**: réplica fiel do padrão de `companies.ts`/`schedule-events.ts` (PK uuid,
`org_id text NOT NULL → orgs.id` indexado, timestamps + trigger `set_updated_at`, RLS
`app_runtime` via GUC `app.current_org`, GRANT como SQL custom na migration). Decisões-chave já
cravadas no spec e detalhadas em [research.md](./research.md): **1 linha por versão** agrupada
por `document_group_id` com `UNIQUE(org_id, document_group_id, version)`; tipo de documento em
**texto livre**; exclusão de pasta não-vazia **RESTRICT** no banco; unicidade de nome de pasta
entre irmãs (inclusive raiz) via `UNIQUE ... NULLS NOT DISTINCT`; status de validade **derivado
na leitura** por função pura (`classifyDocumentValidity`, espelho de `classifyTrainingStatus`);
fila de jobs com claim atômico modelado para `FOR UPDATE SKIP LOCKED` + `locked_at` para
recuperação de claim travado. O acesso administrativo cross-tenant do worker é apenas
**viabilizado** pelo modelo (contrato de claim documentado); a implementação do worker é da #39.

## Technical Context

**Language/Version**: TypeScript `strict` (Next.js 16.2.6 / React 19.2.4; runtime Node serverless na Vercel)

**Primary Dependencies**: Drizzle ORM ^0.45.2 + drizzle-kit ^0.31.10; `postgres` ^3.4.9; zod ^4.4.3

**Storage**: Supabase PostgreSQL (≥15 — pré-requisito do `NULLS NOT DISTINCT`, ver research §3). Runtime conecta como `app_runtime` (pooler 6543); `drizzle-kit` aplica migration via conexão direta unpooled (owner)

**Testing**: Jest (unit, jsdom) para a função pura de validade e schemas zod; integração contra **Postgres efêmero** (`INTEGRATION_*`) para RLS/constraints/claim concorrente — **nunca SQLite** (Constituição §Quality Gates, exceção PostgreSQL)

**Target Platform**: Vercel serverless + Supabase gerenciado

**Project Type**: Web app fullstack Next.js (App Router); esta fatia toca apenas a camada de dados (`src/shared/db/`) + 1 função pura de domínio

**Performance Goals**: N/A (modelagem). Índices em `org_id`, FKs, `(org_id, document_group_id)`, vínculo polimórfico parcial e `(status, created_at)` de jobs para suportar as leituras das fatias #34/#35/#39

**Constraints**: Isolamento multi-tenant não-negociável (Princípio I); banco é fonte de verdade (Princípio V); sem nova infraestrutura (Princípio II); zero UI (FR-014)

**Scale/Scope**: 3 tabelas novas + 3 enums novos; 1 migration (`0025_documents_data_model`); 1 função pura de domínio; ~6 suítes de teste

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio                          | Avaliação                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Status  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| I — Isolamento Multi-Tenant        | As 3 tabelas têm `org_id NOT NULL → orgs.id` indexado + RLS `app_runtime` com `current_setting('app.current_org')` em USING/WITH CHECK (template `companies.ts`); tenant da sessão, nunca do cliente. A leitura administrativa da fila (FR-011) **não relaxa nenhuma policy**: nenhuma policy extra é criada nesta fatia; o worker (#39) usará conexão server-only fora do `app_runtime` (precedentes `caepi-upsert.ts`/`admin.ts`), com escrita de resultado sempre via `withOrg(job.org_id)`. | ✅ PASS |
| II — Stack Fixa / YAGNI            | Sem nova infra; só schema + migration + função pura. A fila é tabela Postgres (não "fila dedicada" — exatamente a alternativa simples que o Princípio II induz). 1 único `job_type` (`pdf_batch`); vínculo polimórfico nasce com 1 tipo (`pgr`). Nenhuma abstração especulativa (sem worker, sem repositório de CRUD).                                                                                                                                                                          | ✅ PASS |
| III — Fatias Verticais             | Fatia de dados independente e testável isoladamente (espelha 006/008); destrava #34/#35/#38/#39 sem depender de nenhuma delas.                                                                                                                                                                                                                                                                                                                                                                  | ✅ PASS |
| IV — Operações Pesadas Assíncronas | É a fatia que **habilita** o Princípio IV para a Fase 05: a fila `jobs` é o mecanismo de desacoplamento da geração em lote. Nenhuma operação pesada roda aqui.                                                                                                                                                                                                                                                                                                                                  | ✅ PASS |
| V — Segurança e Integridade        | Constraints no banco como fonte de verdade: FKs com ON DELETE explícito (RESTRICT na cadeia de pastas), UNIQUE `NULLS NOT DISTINCT` de irmãs, UNIQUE de versão por grupo, CHECKs (`version >= 1`, `size_bytes >= 0`, `attempts >= 0`, vínculo polimórfico completo-ou-vazio), enums fechados. Validação zod complementar; TS strict; nenhum segredo novo.                                                                                                                                       | ✅ PASS |

**Resultado**: nenhuma violação. Complexity Tracking vazio.

**Re-check pós-Phase 1**: design final mantém todos os gates — nenhuma policy além da de
isolamento, nenhuma infra nova, constraints reforçadas no banco. ✅

## Project Structure

### Documentation (this feature)

```text
.specs/023-documents-data-model/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões técnicas e alternativas rejeitadas
├── data-model.md        # Phase 1 — entidades, campos, constraints, RLS, invariantes
├── quickstart.md        # Phase 1 — guia de validação (migration + testes)
├── contracts/
│   └── schema-and-migrations.md   # Contrato do schema/migration/RLS + claim de job + função pura
├── checklists/requirements.md     # (do /speckit-specify)
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/shared/db/
├── schema/
│   ├── documents.ts            # NOVO — folders + documents + enum document_status
│   ├── jobs.ts                 # NOVO — jobs + enums job_type/job_status
│   └── index.ts                # exporta as tabelas/enums/tipos novos
└── migrations/
    ├── 0025_documents_data_model.sql  # CREATE TYPE/TABLE/POLICY + GRANT + triggers (SQL custom)
    └── meta/                          # snapshot/journal drizzle-kit

src/shared/domains/documents/
└── validity.ts                 # NOVO — classifyDocumentValidity (função pura, espelho da 017)
                                #        + documentRelatedEntityTypeSchema (conjunto fechado zod)

src/shared/dates.ts             # EDIT — recebe DUE_WINDOW_DAYS_OPTIONS/DueWindowDays promovidos
                                #        da 017 (re-export mantido em domains/pgr/trainings.ts)

src/__tests__/
├── unit/domains/documents/validity.test.ts
└── integration/shared/db/
    ├── documents-model.test.ts        # constraints de documents (versão/grupo, CHECKs, FK pasta)
    ├── folders-model.test.ts          # hierarquia, unicidade de irmãs (incl. raiz), RESTRICT
    ├── jobs-claim.test.ts             # claim concorrente (SKIP LOCKED) + stale claim + attempts
    └── documents-isolation.test.ts    # RLS/isolation das 3 tabelas (padrão tenant_probe)
```

**Structure Decision**: layout idêntico ao das fatias 006/008 — schema em `src/shared/db/schema/`
(2 arquivos: `documents.ts` agrupa pastas+documentos por coesão da cadeia de FKs; `jobs.ts`
separado porque a fila é ortogonal ao GED), migration em `src/shared/db/migrations/`, função pura
em novo diretório de domínio `src/shared/domains/documents/` (o GED não pertence ao domínio `pgr`;
estrutura DDD por domínio de negócio), testes em `src/__tests__/`. Nenhum repositório de CRUD
nesta fatia (FR-014) — o claim de job é exercitado nos testes de integração com SQL do contrato.

## Complexity Tracking

> Sem violações da constituição — seção intencionalmente vazia.
