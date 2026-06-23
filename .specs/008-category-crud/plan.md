# Implementation Plan: CRUD de Categorias (EPI / Máquina)

**Branch**: `feature/category-crud` | **Date**: 2026-06-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/008-category-crud/spec.md`

## Summary

Entregar o **CRUD completo** (criar, listar paginado/filtrado, carregar por id para edição,
editar, excluir) da entidade **`categories`** (catálogo `epi | machine`) em UI (App Router) +
Server Actions, sobre o modelo de dados já criado na 006 e reusando **toda** a infraestrutura de
CRUD estabelecida na 007.

Abordagem técnica: estender o repositório `categories` (hoje só `list`/`create`) com
`getById`/`update`/`delete` + busca por nome + filtro por tipo + **paginação offset**; criar o
schema de domínio `categoryInputSchema` (zod) e os DTO/mapeadores; expor uma Server Action por
operação via o wrapper **`officeAction`** (que já aplica o gate `requireOfficeStaff()` (FR-025), o
mapeamento de erro padronizado `ActionResult<T>` — `DUPLICATE`/`NOT_FOUND`/`VALIDATION` (FR-023) —
e a auditoria sem PII só na escrita (FR-024)); e telas Server Component (lista) + Client Component
(formulário) reusando os componentes `_ui/list` e `_ui/form`. Todo acesso passa por `withOrg()` +
RLS backstop. **Sem migration nova, sem lib nova, sem nova infraestrutura** (Princípio II).

Esta fatia é um **clone simplificado** do vertical de `job-roles` da 007 (entidade simples), com
três diferenças: (a) há um campo `type` de enum fechado em vez de `companyId`; (b) a unicidade é
`(org_id, type, name)`; (c) **não há dependentes** (catálogo sem FK de entrada) ⇒ exclusão é
confirmar-e-remover, sem aviso de cascata nem helper de contagem.

## Technical Context

**Language/Version**: TypeScript `strict` (Next.js 16.2.6 App Router, React 19.2.4)

**Primary Dependencies**: Drizzle ORM (`postgres` driver), zod 4, Clerk (`@clerk/nextjs`),
Supabase (PostgreSQL + Storage), Tailwind CSS v4. **Sem libs novas** (sem lib de formulário — KISS).

**Storage**: Supabase PostgreSQL. Schema code-first via Drizzle (tabela `categories`, constraint
`uq_categories_org_type_name` e RLS `categories_isolation` **já migradas na 006**, migration
`0005`). Esta fatia **não** cria migration nova.

**Testing**: Jest + Testing Library. Projetos `unit` e `integration`. Integração de Server
Actions/RLS roda contra **Postgres efêmero** (`INTEGRATION_DATABASE_URL` /
`INTEGRATION_APP_RUNTIME_URL`), reusando o harness existente (`_helpers/db.ts`,
`_helpers/pgr-seed.ts` — que já semeia `categoryA`@`org_a` e `categoryB`@`org_b` —, e
`runIsolationSuite`). Exceção do Princípio "Stack/Testes" para recursos exclusivos do Postgres
(RLS/`current_setting`).

**Target Platform**: Vercel (serverless, Next.js fullstack — Server Components + Server Actions,
sem API separada).

**Project Type**: Web app fullstack (Next.js App Router unificado).

**Performance Goals**: CRUD síncrono e leve (Princípio IV). Lista paginada no servidor (offset,
pageSize 20) para não degradar a página conforme o catálogo cresce (FR-002/FR-003).

**Constraints**: Isolamento multi-tenant não-negociável (tenant da sessão via
`requireTenantContext()`, nunca do cliente; RLS backstop); zod antes do banco; unicidade e
integridade reforçadas pela constraint do Postgres definida na 006.

**Scale/Scope**: 1 entidade simples (3 campos); 1 conjunto de telas (lista + form + delete);
volume típico de um catálogo de escritório (dezenas a poucas centenas de itens) — paginação
offset é suficiente.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio                                    | Status  | Como o plano atende                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I — Isolamento Multi-Tenant (NÃO-NEGOCIÁVEL) | ✅ PASS | Todo acesso via `withOrg(tenantId, …)`; `tenantId` de `requireOfficeStaff()`/`requireTenantContext()` (sessão), nunca de input do cliente; RLS `categories_isolation` como backstop (herdado da 006). Em página protegida/Server Action, ausência de tenant é bloqueada pelo gate (não vira "catálogo vazio"); no repositório, ausência de tenant nunca devolve todos os registros. Cross-tenant por id → `NOT_FOUND`/404. Testes de isolamento em Postgres efêmero. |
| II — Stack Fixa & Simplicidade (YAGNI)       | ✅ PASS | Sem nova infra; sem lib de formulário; paginação offset simples; reuso integral de `officeAction`/`ActionResult`/`requireOfficeStaff`/`_ui` da 007 e da tabela/constraint da 006. Sem migration nova.                                                                                                                                                                                                                                                                |
| III — Entrega em Fatias Verticais            | ✅ PASS | Uma fatia vertical independente; US1 (CRUD) é o MVP demonstrável; US2 (isolamento) e US3 (unicidade) são transversais testáveis isoladamente.                                                                                                                                                                                                                                                                                                                        |
| IV — Operações Pesadas Assíncronas           | ✅ PASS | Apenas CRUD rápido e síncrono; sem import em lote, geração de PDF ou upload.                                                                                                                                                                                                                                                                                                                                                                                         |
| V — Segurança e Integridade de Dados         | ✅ PASS | TS `strict`, sem `any`; `categoryInputSchema` (zod) em toda Server Action antes do banco; constraint `UNIQUE(org_id, type, name)` + enum `category_type` do Postgres (006) são a fonte de verdade; segredos só em env.                                                                                                                                                                                                                                               |

**Gate de testes (Princípio "Fluxo/Quality Gates")**: a fatia depende de RLS/`current_setting` ⇒
os testes de isolamento e de Server Action usam **Postgres efêmero** (exceção explícita da
constituição). Unitários (schema/DTO/mapeamento de erro) seguem o default. `npm run lint` +
checagem de tipos + `npm run test` + `npm run test:integration` MUST passar antes de concluir.

**Resultado**: PASS, sem violações. _Complexity Tracking_ vazio.

## Project Structure

### Documentation (this feature)

```text
.specs/008-category-crud/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões técnicas (alinhamento ao padrão 007)
├── data-model.md        # Phase 1 — entidade `categories` (ref. 006) + novas operações/inputs
├── quickstart.md        # Phase 1 — como rodar/testar a fatia
├── contracts/           # Phase 1 — contratos de Server Actions e do repositório
│   ├── server-actions.md
│   └── repositories.md
├── checklists/
│   └── requirements.md  # (gerado no /speckit-specify)
└── tasks.md             # Phase 2 — gerado pelo /speckit-tasks (NÃO por este comando)
```

### Source Code (repository root)

```text
src/
├── app/(protected)/
│   └── categories/                       # NOVO
│       ├── page.tsx                      # lista (Server Component): busca por nome + filtro por tipo + paginação
│       ├── new/page.tsx                  # criar (carrega o form vazio)
│       ├── [id]/edit/page.tsx            # carregar por id p/ edição (= "detalhe"; NÃO há tela só-leitura)
│       └── _components/
│           ├── category-form.tsx         # Client Component (create/update) → Server Actions
│           └── delete-category.tsx       # Client Component → deleteCategoryAction (confirmar-e-remover)
├── shared/
│   ├── server/actions/pgr/
│   │   └── categories.ts                 # NOVO — list/get/create/update/delete via officeAction
│   ├── domains/pgr/
│   │   ├── categories.ts                 # NOVO — categoryInputSchema (zod) + DTO/mapeadores + tipos
│   │   └── validation.ts                 # REUSO — categoryTypeSchema (enum epi|machine) já existe
│   └── db/repositories/
│       └── categories.ts                 # ESTENDER — getById/update/delete + busca/filtro/paginação no list
└── __tests__/
    ├── unit/domains/pgr/
    │   └── categories.test.ts            # NOVO — categoryInputSchema (tipo no enum, nome não-vazio, note opcional)
    └── integration/
        ├── _helpers/pgr-seed.ts          # REUSO (categoryA@org_a / categoryB@org_b já semeados)
        └── pgr/
            └── categories.test.ts        # NOVO — Server Actions: CRUD + DUPLICATE + NOT_FOUND cross-tenant + FORBIDDEN
```

**Structure Decision**: Mesma convenção do vertical `job-roles` da 007. Página de lista é
**Server Component** sob o route group `(protected)` (guard `requireOfficeStaffPage()`);
formulário e botão de exclusão são **Client Components** que chamam **Server Actions** em
`src/shared/server/actions/pgr/categories.ts`. Schema de entrada zod + DTO/mapeadores ficam no
domínio (`src/shared/domains/pgr/categories.ts`), reusando `categoryTypeSchema` de `validation.ts`.
O repositório permanece em `src/shared/db/repositories/` (Repository pattern — actions não tocam o
ORM direto). **Sem tela de detalhe dedicada** (FR-001/A1): o `[id]/edit` é o "detalhe".

## Complexity Tracking

> Sem violações de constituição. Nada a justificar.
