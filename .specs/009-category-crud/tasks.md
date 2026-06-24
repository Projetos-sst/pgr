---
description: "Task list — CRUD de Categorias (EPI / Máquina) (spec 008)"
---

# Tasks: CRUD de Categorias (EPI / Máquina)

**Input**: Design documents from `.specs/009-category-crud/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Tests**: OBRIGATÓRIOS (constituição + CLAUDE.md + SC-006). Unit + integração; isolamento e
unicidade contra **Postgres efêmero** (`INTEGRATION_*`), nunca SQLite.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1..US3 (mapeia as user stories da spec)
- Caminhos de arquivo são relativos à raiz do repositório

**Convenções herdadas (não reinventar — já mergeadas da 006/007):**

- Contrato `ActionResult<T>` (`src/shared/server/result.ts`) + wrapper `officeAction(operation, fn,
{audit?})` (`src/shared/server/office-action.ts`) que aplica gate + mapeamento de erro
  (`toActionError`) + auditoria sem PII só na escrita.
- Gate de papel `requireOfficeStaff()` (`src/shared/auth/require-office-staff.ts`) e guard de
  página `requireOfficeStaffPage()` (`src/shared/auth/page-guards.ts`); papel `client` → `FORBIDDEN`.
- Paginação `resolvePageParams`/`Paginated<T>` (`src/shared/pagination.ts`, pageSize 20, máx 100).
- Componentes de UI reusáveis em `src/app/(protected)/_ui/{list,form}.tsx` e
  `_ui/confirm-delete-button.tsx`.
- Tabela `categories`, constraint `uq_categories_org_type_name`, enum `category_type` e RLS
  `categories_isolation` **já existem** (migration `0005`). **Sem migration nova.**
- Seed de integração `src/__tests__/integration/_helpers/pgr-seed.ts` já semeia
  `categoryA`@`org_a` (`epi`/"Capacete") e `categoryB`@`org_b` (`machine`/"Betoneira").

**Convenções de página (toda página desta fatia — Server Components):**

- **Gate de papel (FR-025/SC-005)**: lista/criação/edição chamam `requireOfficeStaffPage()` no
  topo; vale para **leitura** também — `client` é negado em qualquer rota da fatia.
- **404 cross-tenant (FR-021/SC-002)**: a edição (carregar por id) chama `notFound()` quando
  `getCategoryAction` retorna `NOT_FOUND` (id inexistente ou de outro escritório).
- **Sem tela de detalhe dedicada**: o "detalhe" é o `[id]/edit` (FR-001/A1).
- **Auditoria**: só nas escritas (`officeAction(..., {audit:true})`); leituras não auditam (FR-024).

---

## Phase 1: Setup (estrutura compartilhada)

- [x] T001 Criar a estrutura de pastas da fatia: `src/app/(protected)/categories/`,
      `src/app/(protected)/categories/new/`, `src/app/(protected)/categories/[id]/edit/` e
      `src/app/(protected)/categories/_components/` (os diretórios de teste
      `src/__tests__/unit/domains/pgr/` e `src/__tests__/integration/pgr/` já existem).

---

## Phase 2: Foundational (pré-requisitos bloqueantes)

**⚠️ Nada novo a construir.** Toda a fundação de CRUD é **herdada intacta**: contrato
`ActionResult`/`officeAction`, gate `requireOfficeStaff()`/`requireOfficeStaffPage()`, mapeamento
de erro (`DUPLICATE`/`NOT_FOUND`/`VALIDATION`/`FORBIDDEN`), paginação e componentes `_ui` (007); e
a tabela/constraint/enum/RLS/seed de `categories` (006). Esta fatia **não** adiciona infraestrutura
foundational — as user stories começam direto após o Setup.

**Checkpoint**: fundação herdada disponível — US1 pode começar.

---

## Phase 3: User Story 1 — CRUD de Categoria (Priority: P1) 🎯 MVP

**Goal**: CRUD completo de `categories` (EPI/Máquina): criar, listar (busca por nome + filtro por
tipo + paginação), carregar por id para edição, editar e excluir — escopado ao escritório ativo.

**Independent Test**: criar `EPI`/"Luva" → ver na lista do escritório (filtrar por tipo, buscar
por nome) → abrir edição → alterar nome/observação → salvar → excluir com confirmação; tipo fora
de `epi|machine` ou nome vazio → rejeitado sem persistir.

### Tests for User Story 1 ⚠️ (escrever antes da implementação)

- [x] T002 [P] [US1] Unit: `categoryInputSchema` (tipo no enum `epi|machine`; nome obrigatório
      não-vazio após trim; `note` opcional → undefined quando vazio) em
      `src/__tests__/unit/domains/pgr/categories.test.ts`.
- [x] T003 [P] [US1] Integração: CRUD feliz + validação das Server Actions (criar `epi`/"Luva" em
      `org_a` → aparece no `list`; `get` por id devolve a linha; `update` muda nome; `delete`
      remove e `list.total` cai; tipo inválido → `VALIDATION`; nome vazio → `VALIDATION`) em
      `src/__tests__/integration/pgr/categories.test.ts` (mock de `requireOfficeStaff` como `owner`,
      seed `pgr-seed.ts`, Postgres efêmero).

### Implementation for User Story 1

- [x] T004 [P] [US1] Domínio: `categoryInputSchema` (zod — `type: categoryTypeSchema`,
      `name: requiredString`, `note: optionalString`) e tipos `CategoryInput`/`CategoryValues` em
      `src/shared/domains/pgr/categories.ts` (reusa `categoryTypeSchema` de `validation.ts` e
      `requiredString`/`optionalString` de `form-fields.ts`). **DTO de listagem: `CategoryListItem
= Category`** (sem mapeador no domínio) — o rótulo de tipo (`epi → EPI`, `machine → Máquina`)
      é formatado **na UI**, não no DTO.
- [x] T005 [P] [US1] Estender `src/shared/db/repositories/categories.ts`:
      `listCategories(orgId, {search,type,page,pageSize})→Paginated<Category>` (ilike(name) +
      filtro opcional por `type` + **ordenação por `name` asc** (catálogo) + offset),
      `getCategoryById`, **refatorar** `createCategory` para
      receber `CategoryValues` (remove o `parse` interno e a assinatura `{type:string}`),
      `updateCategory`, `deleteCategory` — todos via `withOrg` + `auditedTenantWrite`
      (`"pgr.categories.write_rejected"`).
- [x] T006 [US1] Buscar todos os usos existentes de `createCategory` no repo e atualizar chamadas
      afetadas pela nova assinatura `CategoryValues`, incluindo testes, seeds ou helpers se
      existirem, em `src/**` e `src/__tests__/**` (depende de T005).
- [x] T007 [US1] Server Actions em `src/shared/server/actions/pgr/categories.ts`
      (`listCategoriesAction`/`getCategoryAction`/`createCategoryAction`/`updateCategoryAction`/
      `deleteCategoryAction` via `officeAction`; `parse` com `categoryInputSchema` antes do repo;
      `NotFoundError` quando `getById`/`update` → `null` ou `delete` → `false`;
      `revalidatePath("/categories")` e `/categories/[id]/edit`; `{audit:true}` nas escritas) —
      depende de T004, T005 (conforme `contracts/server-actions.md`).
- [x] T008 [P] [US1] Página de lista em `src/app/(protected)/categories/page.tsx`: Server Component
      com `requireOfficeStaffPage()`, busca por nome + filtro por tipo (campo `hidden`/select) +
      paginação (`_ui/list`: `SearchForm`/`Table`/`Pagination`/`EmptyState`) consumindo
      `listCategoriesAction`. Lista exibida **ordenada por `name` asc** (vem do repositório, T005);
      o tipo é exibido com **rótulo formatado na UI** (`epi → EPI`, `machine → Máquina`), não no DTO.
- [x] T009 [P] [US1] Formulário Client Component em
      `src/app/(protected)/categories/_components/category-form.tsx` (select de tipo `EPI`/`Máquina`,
      campos nome/observação, exibe `error.fields`/`error.message`; chama create/update) **e** a
      página de criação `src/app/(protected)/categories/new/page.tsx` (gate de papel).
- [x] T010 [US1] Página de edição (= "detalhe") em
      `src/app/(protected)/categories/[id]/edit/page.tsx`: `requireOfficeStaffPage()`, carrega via
      `getCategoryAction(id)` e chama `notFound()` quando `NOT_FOUND`; reusa `CategoryForm` —
      depende de T007, T009.
- [x] T011 [US1] Componente de exclusão confirmar-e-remover em
      `src/app/(protected)/categories/_components/delete-category.tsx` (reusa
      `_ui/confirm-delete-button.tsx`; **sem** aviso de cascata — catálogo sem dependentes, FR-005)
      — depende de T007.
- [x] T012 [US1] Registrar o módulo na navegação: adicionar `{ href: "/categories", label:
"Categorias" }` em `PGR_NAV` de `src/app/(protected)/layout.tsx` e um card em `PGR_MODULES`
      de `src/app/(protected)/dashboard/page.tsx`.

**Checkpoint**: Categoria CRUD completo, isolado e testável — MVP entregável.

---

## Phase 4: User Story 2 — Isolamento entre escritórios (Priority: P1)

**Goal**: garantir que categorias de um escritório nunca apareçam, sejam carregadas, editadas ou
excluídas por outro — e que ausência de tenant não vire "catálogo vazio".

**Independent Test**: como `org_a`, `get`/`update`/`delete` de `categoryB` (de `org_b`) → `NOT_FOUND`;
`list` não traz `categoryB`; papel `client` → `FORBIDDEN` em qualquer operação.

> **Sem nova implementação**: o backstop RLS é herdado da 006 e o mapeamento cross-tenant →
> `NOT_FOUND` já vive nas Server Actions da US1. Esta fase **prova** o comportamento.

### Tests for User Story 2 ⚠️

- [x] T013 [P] [US2] Integração de isolamento em
      `src/__tests__/integration/pgr/categories-isolation.test.ts` (nível Server Action) **+**
      verificação do cenário sem-tenant (nível repositório/RLS): - **Cross-tenant (Server Action)**: como `org_a`, `getCategoryAction(categoryB)`,
      `updateCategoryAction(categoryB, …)` e `deleteCategoryAction(categoryB)` → `NOT_FOUND`;
      `listCategoriesAction` como `org_a` não inclui `categoryB`; gate rejeitando
      (`ForbiddenError`) → toda ação devolve `FORBIDDEN` (reusa `pgr-seed.ts`, Postgres efêmero). - **Sem tenant/GUC fixado (repositório/RLS)**: sem `app.current_org` fixado, uma leitura de
      `categories` **nunca** retorna todos os registros — o comportamento seguro é **erro de
      contexto ou conjunto vazio**, jamais vazamento cross-tenant (spec US2 cenário 4 / FR-021 /
      Inv-2). **Verificar/manter** a cobertura formal já existente em
      `src/__tests__/integration/shared/db/categories-isolation.test.ts` (`runIsolationSuite` —
      caso "sem tenant ativo → vazio"); se essa asserção não existir lá, adicioná-la **a esse
      arquivo** (e só a ela). **Não** duplicar o teste de tabela em `pgr/`.

> Isolamento em nível de **tabela** (A não vê B; escrita cross-tenant rejeitada; **sem tenant ativo
> → vazio, nunca tudo**) é coberto por
> `src/__tests__/integration/shared/db/categories-isolation.test.ts` (`runIsolationSuite`); T013
> cobre o nível de **Server Action** e ancora formalmente o cenário sem-tenant — sem duplicar o
> teste de tabela.

**Checkpoint**: isolamento entre escritórios provado no nível de Server Action.

---

## Phase 5: User Story 3 — Unicidade de nome por tipo no escritório (Priority: P2)

**Goal**: bloquear nome+tipo duplicado no mesmo escritório; permitir o mesmo nome+tipo em
escritórios distintos e o mesmo nome em tipos distintos.

**Independent Test**: criar `epi`/"Capacete" em `org_a` (colide com o seed) → `DUPLICATE`;
`machine`/"Capacete" em `org_a` → ok; `epi`/"Capacete" em `org_b` → ok; editar uma categoria para
um (tipo,nome) que colide → `DUPLICATE`.

> **Sem nova implementação**: a unicidade é a constraint `uq_categories_org_type_name` (006) e o
> mapeamento `23505` → `DUPLICATE` é herdado (007). Esta fase **prova** a regra.

### Tests for User Story 3 ⚠️

- [x] T014 [P] [US3] Integração em `src/__tests__/integration/pgr/categories-uniqueness.test.ts`:
      `createCategoryAction({type:"epi",name:"Capacete"})` em `org_a` → `DUPLICATE`;
      `{type:"machine",name:"Capacete"}` em `org_a` → ok (tipo diferente);
      `{type:"epi",name:"Capacete"}` em `org_b` → ok (sem unicidade global);
      `updateCategoryAction` levando a um (tipo,nome) colidente → `DUPLICATE` (reusa `pgr-seed.ts`,
      Postgres efêmero).

**Checkpoint**: unicidade `(org, type, name)` provada nas três direções (mesmo office / cross-office
/ tipo diferente).

---

## Phase 6: Polish & Cross-Cutting

- [x] T015 [P] Revisar consistência de `revalidatePath` + auditoria sem PII
      (`officeAction(..., {audit:true})` só em create/update/delete; list/get sem audit) em
      `src/shared/server/actions/pgr/categories.ts`.
- [x] T016 Quality gate: `npm run lint` e `npm run typecheck` verdes (TS `strict`, sem `any`
      injustificado). ✓ ambos verdes.
- [~] T017 Rodar `npm run test` e `npm run test:integration`. - **`npm run test` → VERDE e reprodutível** (29 suites / 169 testes, incl.
  `unit/domains/pgr/categories.test.ts`). **Correção de infra de teste aplicada**: `ts-node`
  adicionado como **devDependency** em `package.json` (^10.9.2) — antes o Jest dependia de um
  `npm install --no-save ts-node` não versionado e falhava em checkout limpo (`jest.config.ts`
  exige `ts-node`). Agora roda a partir do `package.json` (não é código de produto). - **`npm run test:integration` → categories NÃO roda de verdade neste ambiente**: as 4 suites de
  `categories` são **coletadas** mas entram em `describe.skip` por falta de
  `INTEGRATION_DATABASE_URL`/`INTEGRATION_APP_RUNTIME_URL` (Postgres efêmero). **0 falhas de
  categories.** 1 falha **pré-existente e não relacionada** (`webhooks/clerk-membership.test.ts`
  exige `NEXT_PUBLIC_SUPABASE_URL`). - **Status: PARCIAL `[~]`.** A validação real de RLS/unicidade (SC-002/003/005) **precisa rodar no
  CI** ou em ambiente com Postgres efêmero. **Não marcar `[X]`** até a integração de categories
  rodar verde de verdade.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: sem dependências.
- **Foundational (P2)**: nada novo — herdado da 006/007; não bloqueia (apenas confirma a fundação).
- **US1 (P3)**: depende só do Setup. É o MVP e **entrega o código** que US2/US3 verificam.
- **US2 (P4) e US3 (P5)**: dependem das Server Actions da US1 (T007) existirem; são fases de
  **verificação** (test-only) — sem implementação nova. Podem rodar em paralelo entre si.
- **Polish (P6)**: depende de US1 concluída (e idealmente US2/US3 verdes).

### User Story Dependencies (independência preservada)

- **US1 Categoria**: só Setup. MVP autossuficiente.
- **US2 Isolamento**: testa o código da US1 + RLS herdada; arquivo de teste próprio
  (`categories-isolation.test.ts`) — independente do arquivo da US1. Cobre **dois níveis**:
  cross-tenant por id → `NOT_FOUND` e `list` que exclui o outro escritório (Server Action), **e** o
  cenário **sem tenant/GUC fixado** → erro de contexto ou conjunto vazio, jamais todos os registros
  (repositório/RLS; verificado/ancorado no teste de tabela `shared/db/categories-isolation.test.ts`
  via `runIsolationSuite`, sem duplicar — spec US2 cenário 4 / FR-021 / Inv-2).
- **US3 Unicidade**: testa o código da US1 + constraint herdada; arquivo de teste próprio
  (`categories-uniqueness.test.ts`) — independente.

### Within User Story 1

- Testes primeiro (devem falhar) → domínio (schema/DTO) + repositório [P] → **atualização dos
  chamadores de `createCategory` (T006)** → Server Actions → UI (lista/form/edição/exclusão) →
  navegação.
- Domínio/repositório antes de T006 e das actions; actions (T007) antes da UI, da edição e do
  componente de exclusão.

### Parallel Opportunities

- US1: T002 e T003 (testes) em paralelo; T004 e T005 (domínio + repositório) em paralelo; T006
  (atualizar chamadores) após T005; T008 e T009 (lista + form) em paralelo após T007.
- Entre fases de verificação: T013 (US2) e T014 (US3) em paralelo, após T007.

---

## Parallel Example: User Story 1

```bash
# Testes da US1 (escrever antes; devem falhar):
Task: "T002 Unit: categoryInputSchema"
Task: "T003 Integração: CRUD + validação das actions"

# Domínio + repositório em paralelo (T006 atualiza chamadores após T005):
Task: "T004 categoryInputSchema + DTOs"
Task: "T005 Estender repositório de categories (refatorar createCategory)"

# Páginas em paralelo (após T007 actions):
Task: "T008 Lista (busca + filtro por tipo + paginação)"
Task: "T009 Form + página de criação"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 Setup → 2. (Foundational herdada) → 3. Phase 3 US1 Categoria (T002–T012) → 4. **VALIDAR**
   US1 isolada (criar/listar/editar/excluir) → 5. demo.

### Incremental Delivery

US1 (MVP, CRUD funcional) → US2 (prova de isolamento) → US3 (prova de unicidade) → Polish. Cada
fase adiciona garantia sem quebrar a anterior.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- US2 e US3 são fases de **verificação** de propriedades do código entregue na US1 (entidade única);
  cada uma em arquivo de teste próprio para preservar independência.
- Verificar que os testes falham antes de implementar.
- Commit por tarefa ou grupo lógico (push é manual).
- **Sem migration nova; sem nova infraestrutura** (Princípios I, II, V). `createCategory` é
  refatorado para `CategoryValues`; **T006** varre e atualiza eventuais chamadores (a verificação
  inicial não encontrou chamadores externos, mas a tarefa garante a consistência).
