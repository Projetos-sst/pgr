# Implementation Plan: CRUDs dos cadastros base do PGR

**Branch**: `feature/pgr-base-cruds` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/007-pgr-base-cruds/spec.md`

## Summary

Entregar o **CRUD completo** (criar, listar paginado, detalhar, editar, excluir) das 5 entidades
da cadeia do PGR — Empresa, Unidade de Obra, Função, GES (com gestão das funções vinculadas) e
Funcionário — em UI (App Router) + Server Actions, sobre o modelo de dados já criado na 006.

Abordagem técnica: estender os repositórios da 006 (hoje só `list`/`create`) com
`getById`/`update`/`delete`/busca-filtros + paginação; introduzir um **contrato de retorno
padronizado** das Server Actions (`ActionResult<T>`, seguindo a forma já usada em `me.ts`);
introduzir um **gate de autorização por papel** (`requireOfficeStaff()` sobre o `role` de
`requireTenantContext()`) que nega o papel `client`; validar entrada com **zod** (reusando
`src/shared/domains/pgr/validation.ts`) antes da regra; consumir os **helpers de derivação** do
nº de expostos já existentes. Todo acesso passa por `withOrg()` + RLS backstop. Sem nova
infraestrutura (Princípio II).

## Technical Context

**Language/Version**: TypeScript `strict` (Next.js 16.2.6 App Router, React 19.2.4)

**Primary Dependencies**: Drizzle ORM 0.45 (`postgres` driver), zod 4, Clerk (`@clerk/nextjs`),
Supabase (PostgreSQL + Storage), Tailwind CSS v4. Sem libs novas (nem de formulário — KISS).

**Storage**: Supabase PostgreSQL. Schema code-first via Drizzle (já migrado na 006, migration
`0005`). Esta fatia **não** cria migration nova (sem alteração de schema).

**Testing**: Jest + Testing Library. Dois projetos: `unit` e `integration`. Integração de RLS/GUC
roda contra **Postgres efêmero** (`INTEGRATION_DATABASE_URL`/`INTEGRATION_APP_RUNTIME_URL`),
reusando o harness existente (`runIsolationSuite`, `pgr-seed.ts`) — exceção do Princípio
"Stack/Testes" para recursos exclusivos do Postgres (RLS).

**Target Platform**: Vercel (serverless, Next.js fullstack — Server Components + Server Actions,
sem API separada).

**Project Type**: Web app fullstack (Next.js App Router unificado).

**Performance Goals**: CRUD síncrono e leve (Princípio IV). Listas paginadas no servidor para não
degradar a página conforme o volume cresce (FR-006).

**Constraints**: Isolamento multi-tenant não-negociável (tenant da sessão, nunca do cliente);
zod antes do banco; integridade reforçada por constraints do Postgres (definidas na 006).

**Scale/Scope**: 5 entidades + 1 junção; ~5 conjuntos de telas; volume típico de um escritório de
SST (dezenas a centenas de registros por entidade) — paginação offset é suficiente.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio | Status | Como o plano atende |
| --- | --- | --- |
| I — Isolamento Multi-Tenant (NÃO-NEGOCIÁVEL) | ✅ PASS | Todo acesso via `withOrg(tenantId, …)`; `tenantId` de `requireTenantContext()` (sessão), nunca de input do cliente; RLS `*_isolation` como backstop (herdado 006); `company_id` tratado como dimensão, não fronteira. Testes de isolamento em Postgres efêmero. |
| II — Stack Fixa & Simplicidade (YAGNI) | ✅ PASS | Sem nova infra; sem lib de formulário; paginação offset simples; `ActionResult` minimalista; reuso de repositórios/validadores/helpers da 006. |
| III — Entrega em Fatias Verticais | ✅ PASS | Uma fatia vertical; US1 (Empresa) é o MVP independentemente testável; demais histórias na ordem da cadeia. |
| IV — Operações Pesadas Assíncronas | ✅ PASS | Apenas CRUD rápido e síncrono; sem geração em lote/import. Upload (logo/foto) está fora de escopo. |
| V — Segurança e Integridade de Dados | ✅ PASS | TS `strict`, sem `any`; zod em toda Server Action antes do banco; constraints do Postgres (FK/UNIQUE/CHECK/enums) da 006 são a fonte de verdade; segredos só em env. |

**Gate de testes (Princípio "Fluxo/Quality Gates")**: a fatia depende de RLS/GUC ⇒ os testes de
isolamento usam **Postgres efêmero** (exceção explícita da constituição). Unitários e integração
não-RLS seguem o default do projeto. `npm run lint` + `npm run typecheck` + `npm run test` +
`npm run test:integration` MUST passar antes de concluir.

**Resultado**: PASS, sem violações. _Complexity Tracking_ vazio.

## Project Structure

### Documentation (this feature)

```text
.specs/007-pgr-base-cruds/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões técnicas
├── data-model.md        # Phase 1 — entidades (ref. 006) + novas operações/inputs
├── quickstart.md        # Phase 1 — como rodar/testar a fatia
├── contracts/           # Phase 1 — contratos de Server Actions e repositórios
│   ├── action-result.md
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
│   ├── companies/              # lista (page.tsx, paginada), new/, [id]/edit (detalhe=edição)
│   ├── work-units/            # idem; ação "copiar endereço da empresa"
│   ├── job-roles/             # idem
│   ├── ges/                   # lista + card "Total"; [id]/ gerencia funções vinculadas
│   └── employees/             # lista (filtros), new/, [id]/ (ficha de detalhe), [id]/edit
├── shared/
│   ├── server/
│   │   ├── result.ts          # NOVO — ActionResult<T> (contrato padronizado, FR-063)
│   │   └── actions/pgr/       # NOVO — uma Server Action por entidade
│   │       ├── companies.ts
│   │       ├── work-units.ts
│   │       ├── job-roles.ts
│   │       ├── ges.ts         # GES + add/edit/remove de ges_job_roles
│   │       └── employees.ts
│   ├── auth/
│   │   ├── require-office-staff.ts  # NOVO — gate de papel (owner/collaborator; nega client)
│   │   └── errors.ts                # + ForbiddenError
│   ├── domains/pgr/
│   │   ├── validation.ts      # REUSO (cpf/cnpj/risk_grade/worker_count/enums)
│   │   ├── exposed-workers.ts # REUSO (derivação)
│   │   ├── companies.ts       # NOVO — zod input schema + DTO mappers
│   │   ├── work-units.ts      # NOVO
│   │   ├── job-roles.ts       # NOVO
│   │   ├── ges.ts             # NOVO (GES + vínculo)
│   │   └── employees.ts       # NOVO
│   └── db/repositories/       # ESTENDER (getById/update/delete/busca/paginação)
│       ├── companies.ts work-units.ts job-roles.ts
│       ├── ges.ts ges-job-roles.ts employees.ts
└── __tests__/
    ├── unit/domains/pgr/      # validação + derivação + DTO mappers
    └── integration/
        ├── _helpers/          # REUSO (db.ts, isolation-suite.ts, pgr-seed.ts) — estender seed se preciso
        └── pgr/               # Server Actions/queries + 404 cross-tenant + isolamento (efêmero)
```

**Structure Decision**: App Router com **route group** `(protected)` (layout já aplica
`requireTenantContext`). Páginas de lista/detalhe são **Server Components**; formulários são
**Client Components** que chamam **Server Actions**. Server Actions ficam em
`src/shared/server/actions/pgr/` (mesma convenção de `me.ts`, testáveis em integração). Schemas
de entrada zod + mapeadores de DTO ficam no domínio (`src/shared/domains/pgr/`), junto de
`validation.ts`/`exposed-workers.ts`. Repositórios permanecem em `src/shared/db/repositories/`
(Repository pattern — services/actions não tocam ORM direto).

## Complexity Tracking

> Sem violações de constituição. Nada a justificar.
