# Implementation Plan: CRUD de Catálogo de EPI / Equipamentos

**Branch**: `feature/epi-catalog-crud` | **Date**: 2026-06-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/010-epi-catalog-crud/spec.md`

## Summary

Entregar o **CRUD completo** (criar, listar paginado/filtrado, carregar por id para edição,
editar, excluir) da entidade **`epi_catalog`** (catálogo de itens `epi | machine`) em UI (App
Router) + Server Actions, sobre o modelo de dados **já criado na 008** (migrations `0007`/`0008`) e
reusando **integralmente** a infraestrutura de CRUD da 007/009.

Abordagem técnica: criar o repositório novo `epi-catalog.ts` (`list` com busca por nome/CA/categoria
+ filtro por tipo + paginação offset + **join escopado por tenant** com `categories` —
`categories.org_id = orgId` e `categories.type = epi_catalog.type` na condição do join, por defesa
em profundidade — para exibir/buscar o nome da categoria; `getById`; `create`/`update` com **assert
de categoria no tenant e de tipo coerente**; `delete` **atômico** — transação única `withOrg` com
`SELECT … FOR UPDATE` + contagem de dependentes **após o lock** + delete, sem corrida;
`countDependents`); criar o schema de
domínio `epiCatalogInputSchema` (zod) + tipos/DTO; expor uma Server Action por operação via o
wrapper **`officeAction`** (gate `requireOfficeStaff()` FR-025, mapeamento `ActionResult<T>` FR-023,
auditoria sem PII só na escrita FR-024); e telas Server Component (lista) + Client Component
(formulário com **Tipo → Categoria em cascata** e botão de exclusão) reusando `_ui/list`,
`_ui/form` e `_ui/confirm-delete-button`. Todo acesso passa por `withOrg()` + RLS backstop. **Sem
migration nova, sem lib nova, sem nova infraestrutura** (Princípio II).

Esta fatia é um **vertical análogo ao de `work-units` da 007** (entidade com FK de referência e com
dependentes), com quatro diferenças derivadas da spec/Clarifications:

- (a) a referência é **`categories` via FK composta `(category_id, type)`** — exige um assert
  explícito no tenant + tipo (a FK composta sozinha não isola tenant, ver Research);
- (b) **sem unicidade** (Q1/FR-017) — nenhuma constraint UNIQUE; nenhum mapeamento `DUPLICATE`;
- (c) **exclusão bloqueia defensivamente** se houver **qualquer** dependente conhecido
  (`epi_stock`/`epi_risk`/`epi_delivery_items`) (Q2/FR-015/016), em vez de cascatear/avisar como a
  007 faz para FKs `CASCADE` — feito numa **transação única com lock de linha** (`FOR UPDATE`) para
  não haver corrida entre contar e deletar; `EntityInUseError` (`IN_USE`, 409);
- (d) catálogo com **muitos campos opcionais** do ePGR (CA, validade, fabricante, norma, tamanho,
  unidade de medida, descrição, foto-path).

> **Nota de seed**: o `_helpers/pgr-seed.ts` **já** semeia `epiCatalogA`@`org_a` (com `epi_stock`,
> `epi_risk` e `epi_delivery_items` apontando para ele) e `epiCatalogB`@`org_b` — ou seja, o caso de
> **exclusão bloqueada** e o de **isolamento cross-tenant** já têm dados prontos; o teste de
> exclusão feliz cria um item **sem** dependentes. Nenhuma extensão de seed é necessária.

## Technical Context

**Language/Version**: TypeScript `strict` (Next.js 16.2.6 App Router, React 19.2.4)

**Primary Dependencies**: Drizzle ORM (`postgres` driver), zod 4, Clerk (`@clerk/nextjs`), Supabase
(PostgreSQL + Storage), Tailwind CSS v4. **Sem libs novas** (sem lib de formulário — KISS).

**Storage**: Supabase PostgreSQL. Schema code-first via Drizzle — tabela `epi_catalog`, FK composta
`epi_catalog_category_id_type_fk (category_id, type) → categories(id, type)` `ON DELETE RESTRICT`,
RLS `epi_catalog_isolation` e os `ON DELETE` dos dependentes (`epi_stock`/`epi_risk` `CASCADE`;
`epi_delivery_items` `RESTRICT`) **já migrados na 008** (`0007`/`0008`). Esta fatia **não** cria
migration nova nem altera schema.

**Testing**: Jest + Testing Library. Projetos `unit` e `integration`. Integração de Server
Actions/RLS roda contra **Postgres efêmero** (`INTEGRATION_DATABASE_URL`, opcional
`INTEGRATION_DATABASE_URL_ADMIN`), reusando o harness existente (`_helpers/db.ts`,
`_helpers/pgr-seed.ts`). Exceção do Princípio "Stack/Testes" para recursos exclusivos do Postgres
(RLS/`current_setting`/FK composta com `ON DELETE`).

**Target Platform**: Vercel (serverless, Next.js fullstack — Server Components + Server Actions, sem
API separada).

**Project Type**: Web app fullstack (Next.js App Router unificado).

**Performance Goals**: CRUD síncrono e leve (Princípio IV). Lista paginada no servidor (offset,
pageSize 20) para não degradar conforme o catálogo cresce (FR-002/003). Select de categoria carrega
até `PAGE_SIZE_MAX` (100) itens por tipo (Research D4).

**Constraints**: Isolamento multi-tenant não-negociável (tenant da sessão via
`requireOfficeStaff()`, nunca do cliente; RLS backstop); zod antes do banco; coerência Tipo×Categoria
e exclusão segura reforçadas no app **e** no banco (FK composta + `RESTRICT`).

**Scale/Scope**: 1 entidade (11 campos, 3 obrigatórios); 1 conjunto de telas (lista + form + delete);
1 repositório + 1 domínio + 1 módulo de Server Actions + 1 erro novo (`EntityInUseError`); volume
típico de catálogo de escritório (dezenas a centenas de itens) — paginação offset suficiente.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio | Status | Como o plano atende |
| --- | --- | --- |
| I — Isolamento Multi-Tenant (NÃO-NEGOCIÁVEL) | ✅ PASS | Todo acesso via `withOrg(tenantId, …)`; `tenantId` de `requireOfficeStaff()` (sessão), nunca de input do cliente; RLS `epi_catalog_isolation` como backstop (008). Cross-tenant por id → `NOT_FOUND`/404. Toda query filtra explicitamente por `org_id` **além** da RLS; o **join com `categories` é escopado por tenant** (`categories.org_id = orgId` + `categories.type = epi_catalog.type` na condição do join — D3), nunca casando categoria de outro tenant/tipo. **Risco específico tratado (Research D1)**: a FK composta `(category_id, type)` é verificada pelo Postgres **ignorando RLS**, então um `category_id` de outro tenant com `type` igual poderia satisfazer a FK — por isso `create`/`update` fazem `assertCategoryInTenant` explícito sob `withOrg` antes de gravar. Testes de isolamento + categoria-de-outro-tenant em Postgres efêmero. |
| II — Stack Fixa & Simplicidade (YAGNI) | ✅ PASS | Sem nova infra; sem lib de formulário; paginação offset simples; reuso integral de `officeAction`/`ActionResult`/`requireOfficeStaff`/`_ui`/`auditedTenantWrite` e do select da 009 (`listCategoriesAction`). Sem migration nova. Único acréscimo: `EntityInUseError` (uma classe `AppError` de ~8 linhas) — necessária para o bloqueio defensivo (Q2). |
| III — Entrega em Fatias Verticais | ✅ PASS | Uma fatia vertical independente; US1 (CRUD) é o MVP demonstrável; US2 (isolamento), US3 (Tipo×Categoria) e US4 (exclusão segura) são transversais testáveis isoladamente. |
| IV — Operações Pesadas Assíncronas | ✅ PASS | Apenas CRUD rápido e síncrono; sem import em lote, PDF ou upload (foto é só `photo_path` textual). |
| V — Segurança e Integridade de Dados | ✅ PASS | TS `strict`, sem `any`; `epiCatalogInputSchema` (zod) em toda Server Action antes do banco; FK composta + enum `category_type` + `RESTRICT` do Postgres (008) são a fonte de verdade; exclusão **atômica** (transação única + `FOR UPDATE`) sem corrida, com pré-checagem de dependentes que **complementa** (não substitui) o `RESTRICT`; `EntityInUseError` chega à UI como `ActionResult{ error.code:"IN_USE" }` (≈409), nunca como exceção crua — asserção obrigatória em teste unit + integração; segredos só em env. |

**Gate de testes**: a fatia depende de RLS/`current_setting` e de FK composta/`ON DELETE` ⇒ os
testes de isolamento, coerência de tipo e exclusão bloqueada usam **Postgres efêmero** (exceção
explícita da constituição). Unitários (schema/DTO/mapeamento) seguem o default. `npm run lint` +
`npm run typecheck` + `npm run test` + `npm run test:integration` MUST passar antes de concluir.

**Resultado**: PASS, sem violações. _Complexity Tracking_ vazio.

## Project Structure

### Documentation (this feature)

```text
.specs/010-epi-catalog-crud/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões técnicas (FK composta×RLS, exclusão defensiva, select)
├── data-model.md        # Phase 1 — entidade `epi_catalog` (ref. 008) + inputs/DTO/operações novas
├── quickstart.md        # Phase 1 — como rodar/testar a fatia
├── contracts/           # Phase 1 — contratos de Server Actions e do repositório
│   ├── server-actions.md
│   └── repositories.md
├── checklists/
│   └── requirements.md  # (gerado no /speckit-specify; revalidado no /speckit-clarify)
└── tasks.md             # Phase 2 — gerado pelo /speckit-tasks (NÃO por este comando)
```

### Source Code (repository root)

```text
src/
├── app/(protected)/
│   └── epi-catalog/                         # NOVO
│       ├── page.tsx                         # lista (Server Component): busca + filtro por tipo + paginação
│       ├── new/page.tsx                     # criar (form vazio)
│       ├── [id]/edit/page.tsx               # carregar por id p/ edição (= "detalhe"; sem tela só-leitura)
│       └── _components/
│           ├── epi-catalog-form.tsx         # Client Component (create/update) — Tipo→Categoria em cascata
│           └── delete-epi-catalog.tsx       # Client Component → deleteEpiCatalogAction (+ dependentes)
├── shared/
│   ├── server/actions/pgr/
│   │   └── epi-catalog.ts                   # NOVO — list/get/create/update/delete/dependents via officeAction
│   ├── domains/pgr/
│   │   ├── epi-catalog.ts                   # NOVO — epiCatalogInputSchema (zod) + DTO/tipos
│   │   ├── form-fields.ts                   # ESTENDER (se preciso) — helper de data ISO opcional
│   │   └── validation.ts                    # REUSO — categoryTypeSchema (enum epi|machine)
│   ├── errors/
│   │   └── entity-in-use-error.ts           # NOVO — AppError code "IN_USE" (status 409) p/ bloqueio defensivo
│   └── db/repositories/
│       └── epi-catalog.ts                   # NOVO — list(join categories)/getById/create/update/delete/countDependents
└── __tests__/
    ├── unit/domains/pgr/
    │   └── epi-catalog.test.ts              # NOVO — epiCatalogInputSchema (obrigatórios, tipo, data, opcionais)
    └── integration/
        ├── _helpers/pgr-seed.ts             # REUSO — já semeia epiCatalogA@org_a com dependentes (stock+risk+delivery_item) e epiCatalogB@org_b
        └── pgr/
            └── epi-catalog.test.ts          # NOVO — Server Actions: CRUD + isolamento + Tipo×Categoria + delete bloqueado + homônimos + FORBIDDEN
```

**Structure Decision**: Mesma convenção do vertical `work-units` da 007. Página de lista é **Server
Component** sob o route group `(protected)` (guard de página herdado); formulário e exclusão são
**Client Components** que chamam **Server Actions** em
`src/shared/server/actions/pgr/epi-catalog.ts`. Schema de entrada zod + DTO ficam no domínio
(`src/shared/domains/pgr/epi-catalog.ts`), reusando `categoryTypeSchema`. O repositório fica em
`src/shared/db/repositories/` (Repository pattern — actions não tocam o ORM direto). **Sem tela de
detalhe dedicada** (FR-001): o `[id]/edit` é o "detalhe". O select de categoria reusa
`listCategoriesAction` (009) filtrando por tipo; **não** se cria CRUD nem listagem nova de
categorias.

## Complexity Tracking

> Sem violações de constituição. O único acréscimo fora do reuso puro é `EntityInUseError` (classe
> `AppError` mínima), justificada pela decisão Q2 (bloqueio defensivo) — flui pelo `toActionError`
> existente sem alterar o mapeamento. Nada a registrar como violação.
