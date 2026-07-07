# Implementation Plan: CRUD do Documento PGR

**Branch**: `feature/pgr-document-crud` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/013-pgr-document-crud/spec.md`

## Summary

Entregar o **CRUD completo do documento PGR** (`pgr`) — list, getById, create, update, delete —
em **dual-surface** (Server Actions + REST `/api/v1/pgr`) + UI (`/pgr`, `/pgr/new`, `/pgr/[id]`,
`/pgr/[id]/edit`), reusando **integralmente** o padrão das fatias `companies`/`work-units`/
`employees`. A tabela `pgr` já existe (migration `0012`); esta fatia é **zero-migration** e não
toca `pgr_ges`/`pgr_revisions`/`risks`/`risk_assessments`/`control_measures`.

Regras de negócio da fatia: **aceite obrigatório da Declaração de Ciência de Riscos NR-01 na
criação, validado no servidor e NÃO persistido**; **`registrationNumber` condicionado ao
`registrationType`**; **`validUntil ≥ issuedAt`**; **filtro dependente Empresa → Obra**; isolamento
multi-tenant por `withOrg` + RLS; `NOT_FOUND` cross-tenant; `FK_NOT_FOUND` (422) para empresa/obra
inválida ou de outra empresa/tenant; **sem 409** (não há unique em `pgr`).

Abordagem técnica (derivada da pesquisa em `research.md`): o domínio reusa
`pgrRegistrationTypeSchema`/`pgrRegistrationTypeLabel` de `domains/pgr/risks.ts` e os primitivos de
`domains/pgr/form-fields.ts`; o repositório copia os guards `assertCompanyInTenant`/
`assertWorkUnitInCompany`; a UI reusa `_ui/list`, `_ui/form` e o overlay de `confirm-delete-button`
para o modal da declaração; os testes usam o Postgres efêmero (`INTEGRATION_*`), com a seed
`pgr-seed.ts` que **já contém** `pgr` por tenant.

## Technical Context

**Language/Version**: TypeScript strict (Next.js 16.2.6 App Router, React 19.2.4)

**Primary Dependencies**: Drizzle ORM + `postgres` (postgres-js) sobre Supabase Postgres; Zod v4;
Clerk (auth de sessão); Tailwind v4. Sem novas dependências.

**Storage**: Postgres (Supabase). Tabela `pgr` (migration `0012`), lida via runtime `app_runtime`
(pooler 6543) com RLS; owner/`drizzle-kit` não é usado (zero-migration).

**Testing**: Jest — projeto `unit` (jsdom) e projeto `integration` (node). Integração contra
**Postgres efêmero** via `INTEGRATION_DATABASE_URL` (admin) + `INTEGRATION_APP_RUNTIME_URL` (role
`app_runtime`, RLS real). Validação manual: Playwright MCP (UI) + cURL (REST).

**Target Platform**: Vercel serverless (Next.js fullstack). Sem API separada.

**Project Type**: Web application (Next.js fullstack, single repo).

**Performance Goals**: CRUD síncrono (Princípio IV — nada pesado/assíncrono aqui). Listagem
paginada (pageSize 20, máx 100).

**Constraints**: Zero-migration; tenant sempre da sessão; Drizzle só em repositório; `any` proibido
sem justificativa; aceite da declaração não-persistido.

**Scale/Scope**: 1 entidade (`pgr`) · 5 operações · 2 superfícies (Actions + REST) · 4 rotas de UI ·
~10 arquivos de produto + ~4 de teste + docs/Postman. MVP = US1 (CRUD) + US2 (aceite).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constituição v1.2.1 — conformidade por princípio:

- **I. Isolamento Multi-Tenant (NÃO-NEGOCIÁVEL)** ✅ — toda query via `withOrg(orgId, …)` +
  `eq(pgr.orgId, orgId)`; tenant vem de `requireOfficeStaff()`/bypass dev (nunca de input do
  cliente); RLS `pgr_isolation` (`app_runtime`) como backstop, provada por
  `pgr-isolation.test.ts` contra Postgres efêmero (não SQLite). `company_id`/`work_unit_id` são
  dimensões DENTRO do tenant, validadas por guards tenant-scopados.
- **II. Stack Fixa e YAGNI** ✅ — nenhuma infra nova; implementa só o requisito da fatia; sem
  abstrações especulativas; `pgr_ges`/`pgr_revisions`/riscos ficam fora.
- **III. Entrega em Fatias Verticais** ✅ — fatia vertical (banco existente → repo → action →
  REST → UI), testável isolada; MVP = US1+US2 antes de US3.
- **IV. Operações Pesadas Assíncronas** ✅ — CRUD é leve/síncrono; nada de PDF/lote nesta fatia.
- **V. Segurança e Integridade** ✅ — TS `strict`, sem `any`; validação Zod antes de qualquer
  escrita; Postgres é fonte de verdade (FK/CHECK/RLS do `0012` como backstop; app valida
  obrigatoriedade das datas e a coerência tipo↔número); segredos só em env.
- **Quality Gates** ✅ — a fatia depende de RLS/policies ⇒ integração em **Postgres efêmero**
  (exceção explícita da constituição ao default SQLite); `npm run lint`/`typecheck`/`test`/
  `test:integration` verdes antes de concluir.

**Resultado**: PASS, sem violações. `Complexity Tracking` vazio (nada a justificar).

## Project Structure

### Documentation (this feature)

```text
.specs/013-pgr-document-crud/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões técnicas
├── data-model.md        # Fase 1 — entidade pgr + schema Zod + projeções
├── quickstart.md        # Fase 1 — test-plan (auto + manual) + comandos reais
├── contracts/
│   ├── repositories.md  # Assinaturas do repositório pgr
│   ├── server-actions.md# Assinaturas das Server Actions pgr
│   └── rest-endpoints.md# Contrato REST /api/v1/pgr
├── checklists/
│   └── requirements.md  # (da /speckit-specify)
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── domains/pgr/
│   │   └── pgr.ts                    # NOVO — pgrInputSchema, pgrCreateSchema, tipos, projeção
│   ├── db/repositories/
│   │   └── pgr.ts                    # NOVO — listPgr/getPgrById/createPgr/updatePgr/deletePgr + guards
│   └── server/actions/pgr/
│       └── pgr.ts                    # NOVO — list/get/create/update/delete Actions
├── app/
│   ├── api/v1/pgr/
│   │   ├── route.ts                  # NOVO — GET (list) / POST (create 201)
│   │   └── [id]/route.ts             # NOVO — GET / PUT / DELETE (204)
│   └── (protected)/
│       ├── layout.tsx                # EDIT — adicionar item de nav { href:"/pgr", label:"PGR" }
│       └── pgr/
│           ├── page.tsx              # NOVO — listagem + filtros Empresa→Obra + Novo + Metodologia + vazio
│           ├── new/page.tsx          # NOVO — criação (carrega opções de empresa)
│           ├── [id]/page.tsx         # NOVO — detalhe (read-only) + Editar + Excluir
│           ├── [id]/edit/page.tsx    # NOVO — edição
│           └── _components/
│               ├── pgr-form.tsx      # NOVO — form criar/editar + cascata Empresa→Obra
│               ├── declaration-modal.tsx  # NOVO — gate NR-01 (overlay estilo confirm-delete)
│               ├── pgr-filters.tsx   # NOVO — filtro dependente Empresa→Obra (client)
│               └── delete-pgr.tsx    # NOVO — wrapper de ConfirmDeleteButton
├── __tests__/
│   ├── unit/domains/pgr/
│   │   └── pgr.test.ts               # NOVO — pgrInputSchema/pgrCreateSchema
│   └── integration/pgr/
│       ├── pgr.test.ts               # NOVO — Server Actions + Postgres efêmero
│       ├── rest-pgr.test.ts          # NOVO — Route Handlers via bypass dev
│       └── pgr-isolation.test.ts     # NOVO — runIsolationSuite({ table:"pgr" })
└── __tests__/integration/_helpers/
    └── pgr-seed.ts                   # (já contém pgr por tenant; estender só se necessário)

docs/api/
├── api-design.md                     # EDIT — seção "PGR" + linhas nas tabelas de recursos/rotas
└── sst-manager.postman_collection.json  # EDIT — pasta "PGR" + variável pgrId
```

**Structure Decision**: Web application Next.js fullstack (camadas
page/handler → action → domain → repository → Drizzle), exatamente como as fatias 007/009/010. Sem
diretórios novos além de `app/(protected)/pgr/**`, `app/api/v1/pgr/**` e os 3 arquivos de
`shared/**`. Nenhuma alteração em `schema/**` ou `migrations/**`.

## Complexity Tracking

> Sem violações da constituição — seção vazia.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
