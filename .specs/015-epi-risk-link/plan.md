# Implementation Plan: Vínculo EPI × risco com neutralização

**Branch**: `feature/epi-risk-link` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/015-epi-risk-link/spec.md`

## Summary

Evoluir o vínculo interino `epi_risk` (EPI × GES, `neutralizes` boolean — fatia 008) para o vínculo
definitivo **EPI × risco** com neutralização de **3 estados** (Sim/Não/Não Aplicável), e construir
toda a camada de fluxo que ainda não existia: domínio Zod, repositório, Server Actions, REST mirror,
UI na tela de edição do risco, docs e testes. É uma fatia de **fluxo completo** (não modelagem pura),
espelhando integralmente a junção de referência **`ges_job_roles`** (GES ↔ funções).

**Abordagem técnica**: 1 migration de evolução (`0014_epi_risk_link`) sobre a tabela `epi_risk` vazia
e sem consumidores (baixo risco) — repontar `ges_id → risk_id` (FK `risks` cascade), trocar
`neutralizes boolean → neutralization epi_neutralization` (enum novo), recriar unique
`(org_id, catalog_id, risk_id)` + índice. Sobre isso, replicar o padrão `ges_job_roles` camada a
camada, reusando os wrappers transversais (`officeAction`, `restHandler`, `withOrg`,
`auditedTenantWrite`, `ActionResult`) e a busca `listEpiCatalog`. O **isolamento** do vínculo depende
de **validar na aplicação** (asserts) que risco e EPI pertencem ao tenant antes do insert, pois a FK
não passa pela RLS.

> **Estado**: fatia **implementada** (commit `ce884a9`); `npm run check` + `npm run build` verdes;
> `db:generate` "No schema changes". Esta spec/plan é **retroativa** (documenta o as-built para
> alinhar a fatia ao fluxo Spec Kit — a implementação foi conduzida por briefing).

## Technical Context

**Language/Version**: TypeScript `strict` (Next.js 16.2.6 / React 19.2.4; runtime Node serverless na Vercel)

**Primary Dependencies**: Drizzle ORM + drizzle-kit; `postgres` (postgres-js); zod 4; Clerk (auth/tenant)

**Storage**: Supabase PostgreSQL. Runtime como `app_runtime` (pooler 6543); `drizzle-kit` aplica migration via conexão direta unpooled (owner)

**Testing**: Jest + Testing Library (unit, jsdom); integração contra **Postgres efêmero** (`INTEGRATION_*`) para RLS/CRUD/isolamento — **nunca SQLite**

**Target Platform**: Vercel serverless + Supabase gerenciado

**Project Type**: Web app fullstack Next.js (App Router) — esta fatia toca dados, domínio, servidor (actions + REST) e UI

**Performance Goals**: N/A (CRUD de baixo volume). Índice em `risk_id` suporta a listagem por risco

**Constraints**: Isolamento multi-tenant não-negociável (Princípio I); banco é fonte de verdade (Princípio V); sem nova infra (Princípio II); regra das 4 partes da API (CLAUDE.md)

**Scale/Scope**: 1 migration; 1 enum novo; 1 tabela evoluída; 2 rotas REST; 5 Server Actions; 1 seção de UI; ~2 suítes de teste novas + 4 dependentes atualizadas

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio                          | Avaliação                                                                                                                                                                                                             | Status  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| I — Isolamento Multi-Tenant        | Toda leitura/escrita via `withOrg`; RLS `epi_risk_isolation` preservada; tenant da sessão. `createRiskEpi` **asserta** risco+EPI no tenant antes do insert (barreira real, pois FK não passa pela RLS). Testes cross-tenant cobrem os 3 vetores. | ✅ PASS |
| II — Stack Fixa / YAGNI            | Sem nova infra; reusa `ges_job_roles` como gabarito e os wrappers existentes. Exclusão física (sem soft delete especulativo — OS não existe).                                                                        | ✅ PASS |
| III — Fatias Verticais             | Fatia vertical completa (dados→UI) e testável isoladamente; entrega valor autônomo (vínculo utilizável no PGR).                                                                                                       | ✅ PASS |
| IV — Operações Pesadas Assíncronas | N/A — CRUD leve, sem operação pesada.                                                                                                                                                                                 | ✅ PASS |
| V — Segurança e Integridade        | Banco como fonte de verdade (FK `risks`/`epi_catalog`, NOT NULL, UNIQUE do par, enum fechado); Zod complementar; erros como códigos de contrato; regra das 4 partes cumprida (Action+REST+docs+Postman).             | ✅ PASS |

**Resultado**: nenhuma violação. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
.specs/015-epi-risk-link/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões D1–D6 + as-built + reconciliação card×repo
├── data-model.md        # Phase 1 — evolução de epi_risk + enum + migration
├── quickstart.md        # Phase 1 — guia de validação (gates + REST + UI)
├── contracts/
│   └── api-and-repositories.md   # Server Actions + REST + repositório + erros
├── checklists/
│   └── requirements.md  # Qualidade da spec
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/shared/db/
├── schema/
│   ├── epis.ts                     # + pgEnum epiNeutralization; epiRisk repontada (D1/D2)
│   └── index.ts                    # exporta epiNeutralization
└── migrations/
    ├── 0014_epi_risk_link.sql      # CREATE TYPE + ALTER (drop/add FK, índices, colunas)
    └── meta/                       # 0014_snapshot.json + _journal.json (à mão, validados)

src/shared/domains/pgr/
└── epi-risk.ts                     # epiNeutralizationSchema + input/update schemas + view types + rótulos

src/shared/db/repositories/
└── epi-risk.ts                     # list/listAvailable/create/update/delete (withOrg + auditedTenantWrite)

src/shared/server/actions/pgr/
└── epi-risk.ts                     # 5 actions via officeAction (+ revalidatePath)

src/app/api/v1/risks/[id]/epis/
├── route.ts                        # GET (list / available) + POST (201)
└── [linkId]/route.ts               # PUT (neutralização) + DELETE (204)

src/app/(protected)/risks/[id]/
├── _components/epi-risco-section.tsx   # UI (client, padrão ManageFunctions)
└── edit/page.tsx                       # monta <EpiRiscoSection riskId={risk.id} />

docs/api/                           # api-design.md + sst-manager.postman_collection.json (regra das 4 partes)

src/__tests__/
├── unit/domains/pgr/epi-risk.test.ts
└── integration/
    ├── pgr/epi-risk.test.ts        # CRUD + DUPLICATE + FK_NOT_FOUND + isolamento + NOT_FOUND + FORBIDDEN
    ├── _helpers/pgr-seed.ts        # [dependente] epi_risk migrado p/ risk_id/neutralization + reordenado
    └── shared/db/                  # [dependentes] epi-constraints / epi-risk-isolation / epi-migration-shape
```

**Structure Decision**: layout em camadas do repo (schema→domínio→repo→actions→REST→UI), idêntico ao
de `ges_job_roles`. Nenhuma pasta nova de topo; a fatia costura dados, servidor e UI de riscos.

## Complexity Tracking

> Sem violações da constituição — seção intencionalmente vazia.
