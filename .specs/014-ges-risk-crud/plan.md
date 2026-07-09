# Implementation Plan: CRUD de Risco do GES

**Branch**: `feature/ges-risk-crud` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/014-ges-risk-crud/spec.md`

## Summary

Entregar o **CRUD completo do inventário de riscos** (`risks`) — list, getById, create, update,
delete — em **dual-surface** (Server Actions + REST `/api/v1/risks`) + UI (`/risks`, `/risks/new`,
`/risks/[id]`, `/risks/[id]/edit`), reusando **integralmente** o padrão da fatia `pgr` (013) e de
`companies`/`ges`. A tabela `risks` já existe (migration `0012`); esta fatia é **zero-migration** e
não toca `risk_assessments`/`control_measures`/`epi_risk`.

Regras de negócio da fatia: **`gesId` obrigatório** (guard tenant-scopado
`assertGesInTenant` → `FK_NOT_FOUND`/422); **`agentType` + `description` obrigatórios**, demais
campos opcionais; **regra `qualitative_na`** — concentração/intensidade só é aceita com unidade de
medida quantitativa (via `superRefine`); **update corpo completo** (mesmo schema do create, sem
gate de declaração); isolamento multi-tenant por `withOrg` + RLS; `NOT_FOUND` (404) cross-tenant;
**sem 409** (não há unique em `risks`); **reutilização de risco por prefill de UI** (sem action de
clone). Os enums e rótulos pt-BR são **reaproveitados** de `domains/pgr/risks.ts`.

Abordagem técnica (derivada de `research.md`): o domínio novo `domains/pgr/risk.ts` importa
`riskAgentTypeSchema`/`exposureTimeSchema`/`measurementUnitSchema` (+ `*Label`) de `./risks` e os
primitivos de `./form-fields`; `concentrationIntensity` é tratada como **string decimal opcional**
(precedente `ges.ceilingHeight` — coluna `numeric` mapeada para string por Drizzle/postgres-js); o
repositório copia o guard `assertGesInTenant` (padrão `assertWorkUnitInCompany`); a UI reusa
`_ui/list`, `_ui/form` e o `ConfirmDeleteButton`; os testes usam o Postgres efêmero
(`INTEGRATION_*`), com `pgr-seed.ts` que **já contém** `risks` por tenant (`riskA`/`riskB`).

## Technical Context

**Language/Version**: TypeScript strict (Next.js 16.2.6 App Router, React 19.2.4)

**Primary Dependencies**: Drizzle ORM + `postgres` (postgres-js) sobre Supabase Postgres; Zod v4;
Clerk (auth de sessão); Tailwind v4. **Sem novas dependências.**

**Storage**: Postgres (Supabase). Tabela `risks` (migration `0012`), lida via runtime `app_runtime`
(pooler 6543) com RLS; `drizzle-kit`/owner não é usado (zero-migration).

**Testing**: Jest — projeto `unit` (jsdom) e projeto `integration` (node). Integração contra
**Postgres efêmero** via `INTEGRATION_DATABASE_URL` (admin) + `INTEGRATION_APP_RUNTIME_URL` (role
`app_runtime`, RLS real). Validação manual: Playwright MCP (UI) + cURL (REST).

**Target Platform**: Vercel serverless (Next.js fullstack). Sem API separada.

**Project Type**: Web application (Next.js fullstack, single repo).

**Performance Goals**: CRUD síncrono (Princípio IV — nada pesado/assíncrono). Listagem paginada
(pageSize 20, máx 100); nomes de GES resolvidos por join (sem N+1).

**Constraints**: Zero-migration; tenant sempre da sessão; Drizzle só em repositório; `any` proibido
sem justificativa; escopo restrito às colunas da tabela `risks`.

**Scale/Scope**: 1 entidade (`risks`) · 5 operações · 2 superfícies (Actions + REST) · 4 rotas de
UI · ~10 arquivos de produto + ~4 de teste + docs/Postman. MVP = US1 (CRUD). US2 (filtros) e US3
(reuso por prefill) incrementam sem bloquear.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Constituição v1.2.1 — conformidade por princípio:

- **I. Isolamento Multi-Tenant (NÃO-NEGOCIÁVEL)** ✅ — toda query via `withOrg(orgId, …)` +
  `eq(risks.orgId, orgId)`; tenant de `requireOfficeStaff()`/bypass dev (nunca de input do
  cliente); RLS `risks_isolation` (`app_runtime`) como backstop, provada por
  `risks-isolation.test.ts` contra Postgres efêmero (não SQLite). `ges_id` é dimensão DENTRO do
  tenant, validada por `assertGesInTenant` tenant-scopado.
- **II. Stack Fixa e YAGNI** ✅ — nenhuma infra/dependência nova; implementa só o requisito da
  fatia; reuso via prefill em vez de action de clone especulativa; `risk_assessments`/
  `control_measures`/`epi_risk` ficam fora.
- **III. Entrega em Fatias Verticais** ✅ — fatia vertical (banco existente → domain → repo →
  action → REST → UI), testável isolada; MVP = US1 antes de US2/US3.
- **IV. Operações Pesadas Assíncronas** ✅ — CRUD leve/síncrono; nada de PDF/lote/IA.
- **V. Segurança e Integridade** ✅ — TS `strict`, sem `any`; validação Zod antes de qualquer
  escrita; Postgres é fonte de verdade (FK `ges_id`/RLS do `0012` como backstop; app valida
  obrigatoriedade de `agentType`/`description` e a regra `qualitative_na`); segredos só em env.
- **Quality Gates** ✅ — a fatia depende de RLS/policies ⇒ integração em **Postgres efêmero**
  (exceção explícita ao default SQLite); `npm run lint`/`typecheck`/`test`/`test:integration`
  verdes antes de concluir.

**Resultado**: PASS, sem violações. `Complexity Tracking` vazio.

## Project Structure

### Documentation (this feature)

```text
.specs/014-ges-risk-crud/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões técnicas
├── data-model.md        # Fase 1 — entidade risks + schema Zod + projeções
├── quickstart.md        # Fase 1 — test-plan (auto + manual) + comandos reais
├── contracts/
│   ├── repositories.md  # Assinaturas do repositório risks
│   ├── server-actions.md# Assinaturas das Server Actions risks
│   └── rest-endpoints.md# Contrato REST /api/v1/risks
├── checklists/
│   └── requirements.md  # (da /speckit-specify)
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── domains/pgr/
│   │   └── risk.ts                     # NOVO — riskInputSchema, tipos, projeção, refine qualitative_na
│   ├── db/repositories/
│   │   └── risks.ts                    # NOVO — listRisks/getRiskById/createRisk/updateRisk/deleteRisk + guard
│   └── server/actions/pgr/
│       └── risks.ts                    # NOVO — list/get/create/update/delete Actions
├── app/
│   ├── api/v1/risks/
│   │   ├── route.ts                    # NOVO — GET (list) / POST (create 201)
│   │   └── [id]/route.ts               # NOVO — GET / PUT / DELETE (204)
│   └── (protected)/
│       ├── layout.tsx                  # EDIT — item de nav { href:"/risks", label:"Riscos" }
│       └── risks/
│           ├── page.tsx                # NOVO — listagem + filtros Empresa→Obra→GES + Novo + vazio
│           ├── new/page.tsx            # NOVO — criação (aceita ?from=<id> p/ prefill de reuso)
│           ├── [id]/page.tsx           # NOVO — detalhe (read-only) + Editar + Reutilizar + Excluir
│           ├── [id]/edit/page.tsx      # NOVO — edição
│           └── _components/
│               ├── risk-form.tsx       # NOVO — form criar/editar + cascata Empresa→Obra→GES
│               ├── risk-filters.tsx    # NOVO — filtro dependente Empresa→Obra→GES (client)
│               └── delete-risk.tsx     # NOVO — wrapper de ConfirmDeleteButton
├── __tests__/
│   ├── unit/domains/pgr/
│   │   └── risk.test.ts                # NOVO — riskInputSchema (obrigatórios, enums, qualitative_na)
│   └── integration/risks/
│       ├── risks.test.ts               # NOVO — Server Actions + Postgres efêmero
│       ├── rest-risks.test.ts          # NOVO — Route Handlers via bypass dev
│       └── risks-isolation.test.ts     # NOVO — runIsolationSuite({ table:"risks" })
└── __tests__/integration/_helpers/
    └── pgr-seed.ts                     # (já contém risks por tenant; estender só se necessário)

docs/api/
├── api-design.md                       # EDIT — seção "Riscos" + linhas nas tabelas de recursos/rotas
└── sst-manager.postman_collection.json # EDIT — pasta "Riscos" + variável riskId
```

**Structure Decision**: Web application Next.js fullstack (camadas
page/handler → action → domain → repository → Drizzle), exatamente como as fatias 007/009/013. Sem
diretórios novos além de `app/(protected)/risks/**`, `app/api/v1/risks/**` e os 3 arquivos de
`shared/**`. Nenhuma alteração em `schema/**` ou `migrations/**`.

> **Nota de nomenclatura**: o domínio novo é `domains/pgr/risk.ts` (singular) para **não** colidir
> com o já existente `domains/pgr/risks.ts` (enums/labels/matriz da fatia de modelo), que é
> importado por ele. O repositório é `repositories/risks.ts`, as actions `actions/pgr/risks.ts` e a
> UI `/risks` (plural), sem colisão.

## Complexity Tracking

> Sem violações da constituição — seção vazia.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |
