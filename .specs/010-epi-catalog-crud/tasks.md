---
description: "Task list — CRUD de Catálogo de EPI / Equipamentos (spec 010)"
---

# Tasks: CRUD de Catálogo de EPI / Equipamentos

**Input**: Design documents from `.specs/010-epi-catalog-crud/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md
**Tests**: OBRIGATÓRIOS (constituição + CLAUDE.md + SC-009/010). Unit + integração; isolamento,
coerência Tipo×Categoria e exclusão bloqueada contra **Postgres efêmero** (`INTEGRATION_*`), nunca
SQLite.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1..US4 (mapeia as user stories da spec)
- Caminhos de arquivo são relativos à raiz do repositório

**Convenções herdadas (não reinventar — já mergeadas da 006/007/008/009):**

- Contrato `ActionResult<T>` (`src/shared/server/result.ts`) + wrapper `officeAction(operation, fn,
{audit?})` (`src/shared/server/office-action.ts`) que aplica gate + mapeamento de erro
  (`toActionError`, `src/shared/server/action-error.ts`) + auditoria sem PII só na escrita.
- Gate de papel `requireOfficeStaff()` (`src/shared/auth/require-office-staff.ts`) e guard de página
  `requireOfficeStaffPage()`; papel `client` → `FORBIDDEN`.
- Paginação `resolvePageParams`/`Paginated<T>` (`src/shared/pagination.ts`, pageSize 20, máx 100).
- Componentes de UI reusáveis em `src/app/(protected)/_ui/list.tsx` (`PageHeader`/`PrimaryLink`/
  `EmptyState`/`SearchForm`/`Pagination`/`Table`), `_ui/form.tsx` (`TextField`/`SelectField`/
  `FormError`/`FieldError`/`FormActions`/`SubmitButton`) e `_ui/confirm-delete-button.tsx`.
- Erros `AppError` (`src/shared/errors/*`): `NotFoundError` (`NOT_FOUND`), `ReferenceNotFoundError`
  (`FK_NOT_FOUND`). `toActionError` mapeia `AppError` genérico para `ActionResult` e PG `23503` →
  `FK_NOT_FOUND`.
- Tabela `epi_catalog`, FK composta `(category_id, type) → categories(id, type)` `ON DELETE
RESTRICT`, dependentes (`epi_stock`/`epi_risk` `CASCADE`; `epi_delivery_items` `RESTRICT`) e RLS
  `epi_catalog_isolation` **já existem** (migrations `0007`/`0008`). **Sem migration nova; sem
  alterar schema.**
- Catálogo `categories` (009) reusado como taxonomia; `listCategoriesAction` reusada no select
  dependente. **Sem CRUD de categorias nesta fatia.**
- Seed de integração `src/__tests__/integration/_helpers/pgr-seed.ts` **já** semeia `categoryA`@
  `org_a`, `categoryB`@`org_b`, `epiCatalogA`@`org_a` (`epi`, categoria A, "Capacete CA-123") **com**
  `epi_stock` + `epi_risk` + `epi_delivery_items` apontando para ele, e `epiCatalogB`@`org_b`.

**Convenções de página (toda página desta fatia — Server Components):**

- **Gate de papel (FR-025/SC-009)**: lista/criação/edição chamam `requireOfficeStaffPage()` no topo;
  vale para **leitura** também — `client` é negado em qualquer rota da fatia.
- **404 cross-tenant (FR-021/SC-003)**: a edição (carregar por id) chama `notFound()` quando
  `getEpiCatalogAction` retorna `NOT_FOUND`.
- **Sem tela de detalhe dedicada**: o "detalhe" é o `[id]/edit` (FR-001).
- **Auditoria**: só nas escritas (`officeAction(..., {audit:true})`); leituras não auditam (FR-024).

---

## Phase 1: Setup (estrutura compartilhada)

- [x] T001 Criar a estrutura de pastas da fatia: `src/app/(protected)/epi-catalog/`,
      `src/app/(protected)/epi-catalog/new/`, `src/app/(protected)/epi-catalog/[id]/edit/` e
      `src/app/(protected)/epi-catalog/_components/` (os diretórios de teste
      `src/__tests__/unit/domains/pgr/` e `src/__tests__/integration/pgr/` já existem).

---

## Phase 2: Foundational (pré-requisitos bloqueantes)

**Bloqueia o repositório/actions (delete defensivo).** Único item novo de infraestrutura: o erro
`EntityInUseError` e a garantia de que ele vira contrato `IN_USE`.

- [x] T002 Criar `EntityInUseError` em `src/shared/errors/entity-in-use-error.ts`: `class
EntityInUseError extends AppError` com `code = "IN_USE"` (status `409`) e mensagem padrão
      pt-BR (ex.: "Item em uso e não pode ser excluído."). Segue o padrão de `not-found-error.ts`/
      `reference-not-found-error.ts`; **não** altera `action-error.ts` (o ramo genérico de
      `AppError` já o mapeia).
- [x] T003 [P] Unit: garantir que `toActionError(new EntityInUseError())` retorna
      `{ code: "IN_USE", message }` (≈409) — isto é, o erro vira `ActionResult` e **nunca** vaza como
      exceção crua — em `src/__tests__/unit/shared/server/action-error.test.ts` (criar o arquivo se
      não existir). Depende de T002.

**Checkpoint**: `EntityInUseError` disponível e provado como contrato `IN_USE` — repositório/actions
podem usá-lo.

---

## Phase 3: User Story 1 — CRUD do item de catálogo (Priority: P1) 🎯 MVP

**Goal**: CRUD completo de `epi_catalog`: criar, listar (busca por nome/CA/categoria + filtro por
tipo + paginação), carregar por id para edição, editar e excluir — escopado ao escritório ativo, com
categoria coerente com o tipo.

**Independent Test**: criar item `EPI` com categoria compatível e nome válido → ver na lista
(colunas do ePGR, filtrar por tipo, buscar) → abrir edição → alterar CA/validade/fabricante →
salvar → excluir (item sem dependentes) com confirmação; tipo inválido / nome vazio / `categoryId`
ausente → rejeitado sem persistir; dois itens homônimos → ambos aceitos (sem `DUPLICATE`).

### Tests for User Story 1 ⚠️ (escrever antes da implementação)

- [x] T004 [P] [US1] Unit: `epiCatalogInputSchema` em
      `src/__tests__/unit/domains/pgr/epi-catalog.test.ts` — aceita entrada mínima válida
      (`type`+`categoryId`+`name`); rejeita tipo fora de `epi|machine`, `name` vazio/só-espaços,
      `categoryId` não-uuid/ausente e `caValidUntil` malformada; normaliza opcionais vazios para
      `undefined`; aceita `caValidUntil` ISO (`YYYY-MM-DD`) válida.
- [x] T005 [P] [US1] Integração: CRUD feliz + busca/filtro + homônimos + validação das Server
      Actions em `src/__tests__/integration/pgr/epi-catalog.test.ts` (mock de `requireOfficeStaff`
      como `owner` de `org_a`, seed `pgr-seed.ts`, Postgres efêmero):
      criar item `epi` em `org_a` com `categoryA` → aparece no `list` (com `categoryName`); `get`
      por id devolve a linha; `update` muda CA/validade; `delete` de item **sem** dependentes remove
      e `list.total` cai; **busca** por nome/CA/nome-da-categoria retorna o subconjunto correto;
      **filtro** por tipo funciona; **homônimos** (dois itens mesmo tipo/nome) → ambos aceitos, sem
      `DUPLICATE`; tipo inválido / nome vazio / `categoryId` não-uuid → `VALIDATION`.

### Implementation for User Story 1

- [x] T006 [P] [US1] Domínio em `src/shared/domains/pgr/epi-catalog.ts`: `epiCatalogInputSchema`
      (zod — `type: categoryTypeSchema`, `categoryId: z.string().uuid()`, `name: requiredString`,
      opcionais `ca`/`manufacturer`/`norm`/`size`/`unitOfMeasure`/`description`/`photoPath` via
      `optionalString`, `caValidUntil` via `optionalIsoDate`); tipos `EpiCatalogInput` =
      `z.input<…>` e `EpiCatalogValues` = `z.output<…>`; DTO `EpiCatalogListItem = EpiCatalog & {
categoryName: string }`. Reusa `categoryTypeSchema` (`validation.ts`) e
      `requiredString`/`optionalString` (`form-fields.ts`). Se `optionalIsoDate` ainda não existir,
      adicioná-lo em `src/shared/domains/pgr/form-fields.ts` (vazio→`undefined`; senão data ISO
      válida) — **sem** reescrever validadores existentes.
- [x] T007 [P] [US1] Repositório novo `src/shared/db/repositories/epi-catalog.ts` (Repository
      pattern; só ele toca o ORM; todas as ops via `withOrg` + filtro explícito por `org_id`;
      escritas via `auditedTenantWrite("pgr.epi_catalog.write_rejected")`), conforme
      `contracts/repositories.md`: - `listEpiCatalog(orgId, {search,type,page,pageSize})→Paginated<EpiCatalogListItem>` —
      `innerJoin(categories)` **escopado por tenant**: `and(eq(epiCatalog.categoryId,
categories.id), eq(categories.orgId, orgId), eq(categories.type, epiCatalog.type))`; `where
eq(epiCatalog.orgId, orgId)` + busca `or(ilike(epiCatalog.name), ilike(epiCatalog.ca),
ilike(categories.name))` + filtro `eq(epiCatalog.type)`; ordenação `name` asc; offset;
      `{rows,total}` com o mesmo join/where. - `getEpiCatalogById(orgId, id)→EpiCatalog|null`. - `createEpiCatalog(orgId, input)` e `updateEpiCatalog(orgId, id, input)` — chamam
      `assertCategoryInTenant(tx, orgId, input.categoryId, input.type)` (privada; select
      `categories` por `(org_id,id,type)`; `ReferenceNotFoundError("category")` se ausente) antes
      de gravar. - `deleteEpiCatalog(orgId, id)→boolean` — **transação única `withOrg`**: `SELECT id … WHERE
org_id AND id FOR UPDATE` (trava; `false` se ausente/cross-tenant) → conta dependentes
      **após o lock** → `throw new EntityInUseError()` se soma>0 → senão `DELETE … RETURNING {id}`;
      `try/catch` SQLSTATE `23503` (backstop `epi_delivery_items`) → `throw new EntityInUseError()`
      (captura **local ao delete**). - `countEpiCatalogDependents(orgId, id)→{stock,risk,deliveryItems}` — 3× `count(*)::int`
      (escopo `org_id`) sob `withOrg`, **sem** lock (leitura informativa p/ a UI).
      Depende de T002 (`EntityInUseError`) e T006 (`EpiCatalogValues`/DTO).
- [x] T008 [US1] Server Actions em `src/shared/server/actions/pgr/epi-catalog.ts` conforme
      `contracts/server-actions.md`: `listEpiCatalogAction`/`getEpiCatalogAction`/
      `createEpiCatalogAction`/`updateEpiCatalogAction`/`deleteEpiCatalogAction`/
      `getEpiCatalogDependentsAction` via `officeAction`; `epiCatalogInputSchema.parse(input)`
      **antes** do repo (FR-022); `NotFoundError` quando `getById`/`update`→`null` ou
      `delete`→`false`; `EntityInUseError`→`IN_USE` flui do repo; `revalidatePath("/epi-catalog")` e
      `/epi-catalog/[id]/edit`; `{audit:true}` só em create/update/delete; `list`/`get`/`dependents`
      sem audit. Depende de T006, T007.
- [x] T009 [P] [US1] Página de lista em `src/app/(protected)/epi-catalog/page.tsx`: Server Component
      com `requireOfficeStaffPage()`, busca por nome/CA/categoria (`SearchForm`) + filtro por tipo
      (select com `hidden` de `search`) + paginação (`Pagination`/`EmptyState`/`Table`/`PageHeader`/
      `PrimaryLink`) consumindo `listEpiCatalogAction`. **Colunas**: CA, Nome, Tamanho, Fabricante,
      Tipo, Categoria (`categoryName`), Unidade de Medida, Validade (do CA), Opções (editar +
      excluir). Tipo exibido com rótulo formatado na UI (`epi → EPI`, `machine → Máquinas e
Equipamentos`); validade via `toLocaleDateString('pt-BR')`. **Estado vazio** orientando o
      primeiro cadastro (distinto de "busca sem resultado"). **Paginação preserva filtro/busca
      (FR-003)**: passar os `searchParams` atuais (`search` e `type`) como `params` do componente
      `Pagination` (que os reaplica via `buildQuery`), de modo que navegar entre páginas mantém a
      busca e o filtro por tipo e nunca cruza escritórios. Depende de T008.
- [x] T010 [P] [US1] Formulário Client Component em
      `src/app/(protected)/epi-catalog/_components/epi-catalog-form.tsx`: **controlado** para `type`
      e `categoryId`; **Tipo → Categoria em cascata** — ao montar e a cada troca de `type`, chama
      `listCategoriesAction({ type, pageSize: 100 })` (009) e popula o `SelectField` de categoria
      (troca de tipo limpa `categoryId`); campos `name` (obrig.), `ca`, `caValidUntil` (input
      `type="date"`), `manufacturer`, `norm` (label "Norma"), `size`, `unitOfMeasure`, `description`,
      `photoPath` (texto — **sem upload**); exibe `error.fields`/`error.message`; chama
      create/update. **E** a página de criação `src/app/(protected)/epi-catalog/new/page.tsx`
      (`requireOfficeStaffPage()`). Depende de T008.
- [x] T011 [US1] Página de edição (= "detalhe") em
      `src/app/(protected)/epi-catalog/[id]/edit/page.tsx`: `requireOfficeStaffPage()`, carrega via
      `getEpiCatalogAction(id)` e chama `notFound()` quando `NOT_FOUND`; reusa `EpiCatalogForm`.
      Depende de T008, T010.
- [x] T012 [US1] Componente de exclusão em
      `src/app/(protected)/epi-catalog/_components/delete-epi-catalog.tsx`: reusa
      `_ui/confirm-delete-button.tsx` passando `deleteAction = deleteEpiCatalogAction`,
      `loadDependentsAction = getEpiCatalogDependentsAction` e `dependentLabels` ({ stock: "Estoque",
      risk: "Vínculos de risco", deliveryItems: "Itens de entrega" }), com `description` deixando
      claro que **a exclusão é bloqueada se houver dependentes** (o `error.message` `IN_USE` aparece
      ao confirmar). Depende de T008.
- [x] T013 [US1] Registrar o módulo na navegação: adicionar `{ href: "/epi-catalog", label:
"Catálogo de EPI" }` em `PGR_NAV` de `src/app/(protected)/layout.tsx` e um card em
      `PGR_MODULES` de `src/app/(protected)/dashboard/page.tsx`.

**Checkpoint**: CRUD de `epi_catalog` completo, isolado e testável — MVP entregável.

---

## Phase 4: User Story 2 — Isolamento entre escritórios (Priority: P1)

**Goal**: itens de um escritório nunca aparecem, são carregados, editados ou excluídos por outro; e
ausência de tenant não vira "catálogo vazio".

**Independent Test**: como `org_a`, `get`/`update`/`delete` de `epiCatalogB` (de `org_b`) →
`NOT_FOUND`; `list` não traz `epiCatalogB`; papel `client` → `FORBIDDEN`; sem tenant/GUC fixado →
nunca todos os registros.

> **Sem nova implementação**: backstop RLS herdado da 008 e mapeamento cross-tenant → `NOT_FOUND` já
> vivem nas Server Actions da US1. Esta fase **prova** o comportamento.

### Tests for User Story 2 ⚠️

- [x] T014 [P] [US2] Integração de isolamento em
      `src/__tests__/integration/pgr/epi-catalog-isolation.test.ts` (nível Server Action):
      como `org_a`, `getEpiCatalogAction(epiCatalogB)` / `updateEpiCatalogAction(epiCatalogB, …)` /
      `deleteEpiCatalogAction(epiCatalogB)` → `NOT_FOUND`; `listEpiCatalogAction` como `org_a` não
      inclui `epiCatalogB`; gate rejeitando (`ForbiddenError`) → toda ação devolve `FORBIDDEN`
      (reusa `pgr-seed.ts`, Postgres efêmero). O cenário **sem tenant/GUC → vazio, nunca tudo** (nível
      tabela/RLS) já é coberto por
      `src/__tests__/integration/shared/db/epi-catalog-isolation.test.ts` (008,
      `runIsolationSuite`); **verificar/manter** essa cobertura — **não** duplicar o teste de tabela
      em `pgr/`. Depende de T008.

**Checkpoint**: isolamento entre escritórios provado no nível de Server Action.

---

## Phase 5: User Story 3 — Coerência Tipo × Categoria (Priority: P1)

**Goal**: a categoria aceita é sempre do mesmo tipo do item e do próprio escritório; o backend é a
guarda final mesmo que a UI falhe.

**Independent Test**: criar/editar item `epi` apontando para categoria `machine` → referência
inválida; apontar para categoria de outro escritório (`categoryB`) ou para `category_id` inexistente
→ referência inválida; apontar para categoria compatível do próprio escritório → aceito.

> **Sem nova implementação**: a guarda é `assertCategoryInTenant` (T007) + a FK composta (008) como
> backstop. Esta fase **prova** a regra contra o backend, ignorando a filtragem da UI.

### Tests for User Story 3 ⚠️

- [x] T015 [P] [US3] Integração em
      `src/__tests__/integration/pgr/epi-catalog-category-coherence.test.ts` (como `org_a`, seed,
      Postgres efêmero): `createEpiCatalogAction` com `type:"machine"` + `categoryId = categoryA`
      (que é `epi`) → `FK_NOT_FOUND`; com `categoryId = categoryB` (de `org_b`) → `FK_NOT_FOUND`; com
      `categoryId` inexistente (uuid aleatório) → `FK_NOT_FOUND`; com `type:"epi"` + `categoryA`
      (compatível, mesmo tenant) → sucesso. Repetir os casos de rejeição para
      `updateEpiCatalogAction`. Depende de T008.

**Checkpoint**: coerência Tipo×Categoria garantida pelo backend, independente da UI.

---

## Phase 6: User Story 4 — Exclusão segura com dependentes (Priority: P1)

**Goal**: excluir com confirmação; bloquear (sem cascata) quando houver qualquer dependente
conhecido, com mensagem clara; backstop de banco honrado.

**Independent Test**: excluir item sem dependentes → removido; excluir `epiCatalogA` (tem
estoque+risco+item-de-entrega no seed) → `IN_USE`, nada removido nem cascateado; manter só
`epi_delivery_items` → ainda `IN_USE` **pela pré-checagem** (que conta `deliveryItems`), não
`FK_NOT_FOUND`.

> **Sem nova implementação**: a lógica está em `deleteEpiCatalog` (T007, transação única + `FOR
UPDATE` + contagem + `IN_USE` + backstop). Esta fase **prova** o comportamento e o contrato.

### Tests for User Story 4 ⚠️

- [x] T016 [P] [US4] Integração em
      `src/__tests__/integration/pgr/epi-catalog-delete.test.ts` (como `org_a`, seed, Postgres
      efêmero): - **Sem dependentes**: criar item novo sem dependentes → `deleteEpiCatalogAction` →
      `{ ok:true }`; some do `list`. - **Com dependentes (bloqueio + sem cascade)**: `deleteEpiCatalogAction(epiCatalogA)` →
      `{ ok:false, error:{ code:"IN_USE" } }` (≈409), **sem** exceção crua; o item **e** os
      dependentes (`epi_stock`/`epi_risk`/`epi_delivery_items`) **continuam** no banco (nada
      cascateado). `getEpiCatalogDependentsAction(epiCatalogA)` retorna contagens > 0. - **Delivery item only (via pré-checagem)**: removendo `epi_stock` + `epi_risk` de
      `epiCatalogA` e mantendo **só** `epi_delivery_items`, `deleteEpiCatalogAction(epiCatalogA)`
      → `IN_USE` **pela pré-checagem** (que conta `deliveryItems`), retornado **antes** do
      `DELETE`; o item **e** o `epi_delivery_items` continuam no banco (não `FK_NOT_FOUND`). > **Nota (M1)**: o `try/catch` de SQLSTATE `23503` em `deleteEpiCatalog` é > **cinto-e-suspensório** para corrida/estado inesperado e **não** precisa de teste > determinístico — a pré-checagem já conta `epi_delivery_items` e o `SELECT … FOR UPDATE` > serializa inserts concorrentes de dependentes, tornando o caminho `23503` praticamente > inalcançável de forma determinística. A cobertura determinística desta US é a **pré-checagem > + preservação dos dependentes** (casos acima), não o `catch 23503`.
      Depende de T008.

**Checkpoint**: exclusão segura provada — bloqueio defensivo (pré-checagem) + dependentes
preservados, via contrato `IN_USE`; o `catch 23503` permanece como backstop não-determinístico.

---

## Phase 7: Polish & Cross-Cutting

- [x] T017 [P] Revisar consistência de `revalidatePath` + auditoria sem PII
      (`officeAction(..., {audit:true})` só em create/update/delete; list/get/dependents sem audit)
      e ausência de `any` em `src/shared/server/actions/pgr/epi-catalog.ts` e
      `src/shared/db/repositories/epi-catalog.ts`.
- [x] T018 Quality gate estático: `npx prettier --write` nos arquivos tocados (ou `npm run format` /
      `npm run format:check` — scripts reais `prettier --write .` / `prettier --check .`),
      `npm run lint` e `npm run typecheck` verdes (TS `strict`, sem `any` injustificado).
- [~] T019 Quality gate de testes: `npm run test` (unit — `epi-catalog.test.ts` e
  `action-error.test.ts` verdes) e `npm run test:integration` (Postgres efêmero — CRUD,
  isolamento, coerência Tipo×Categoria e exclusão bloqueada verdes). Opcionalmente `npm run
check` como agregador (`format:check && lint && typecheck && test`; **não** inclui integração).
  Sem `INTEGRATION_*`, as suítes de integração entram em `describe.skip` — a validação real
  precisa rodar no CI/ambiente com Postgres efêmero (não marcar a fatia concluída só com unit).
  **STATUS PARCIAL `[~]`**: `npm run test` (unit) **VERDE** (31 suites / 192 testes, inclui
  `unit/domains/pgr/epi-catalog.test.ts` e o caso `EntityInUseError → IN_USE` em
  `action-error.test.ts`). `npm run test:integration` **NÃO validado neste ambiente**: as 4
  suítes de `epi-catalog` são coletadas mas entram em `describe.skip` por falta de
  `INTEGRATION_DATABASE_URL`/`INTEGRATION_APP_RUNTIME_URL`. 1 falha **pré-existente e não
  relacionada** (`webhooks/clerk-membership.test.ts` exige `NEXT_PUBLIC_SUPABASE_URL`). A
  validação real de RLS/FK composta/exclusão **precisa rodar no CI** com Postgres efêmero —
  **não marcar `[X]`** até a integração de `epi-catalog` rodar verde de verdade.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: `EntityInUseError` (T002) + seu teste de contrato (T003); bloqueia o
  repositório/actions (delete defensivo).
- **US1 (Phase 3)**: depende de Setup + Foundational. É o MVP e **entrega o código** que US2/US3/US4
  verificam.
- **US2 (Phase 4), US3 (Phase 5), US4 (Phase 6)**: dependem das Server Actions da US1 (T008); são
  fases de **verificação** (test-only) — sem implementação nova. Podem rodar em paralelo entre si.
- **Polish (Phase 7)**: depende de US1 concluída (e idealmente US2/US3/US4 verdes).

### User Story Dependencies (independência preservada)

- **US1 CRUD**: Setup + Foundational. MVP autossuficiente.
- **US2 Isolamento**, **US3 Tipo×Categoria**, **US4 Exclusão**: testam o código da US1; cada uma em
  arquivo de teste próprio — independentes entre si.

### Within User Story 1

- Testes primeiro (devem falhar) → domínio (T006) + repositório (T007) [P] → Server Actions (T008) →
  UI (lista T009 / form+new T010 / edição T011 / exclusão T012) → navegação (T013).
- Domínio/repositório antes das actions; actions (T008) antes da UI, da edição e da exclusão.

### Parallel Opportunities

- Foundational: T003 após T002.
- US1: T004 e T005 (testes) em paralelo; T006 e T007 (domínio + repositório) em paralelo após T002;
  T009 e T010 (lista + form) em paralelo após T008.
- Entre fases de verificação: T014 (US2), T015 (US3) e T016 (US4) em paralelo, após T008.

---

## Parallel Example: User Story 1

```bash
# Testes da US1 (escrever antes; devem falhar):
Task: "T004 Unit: epiCatalogInputSchema"
Task: "T005 Integração: CRUD + busca/filtro + homônimos + validação"

# Domínio + repositório em paralelo (após T002 EntityInUseError):
Task: "T006 epiCatalogInputSchema + tipos + DTO + optionalIsoDate"
Task: "T007 Repositório epi-catalog (join escopado + delete atômico)"

# Páginas em paralelo (após T008 actions):
Task: "T009 Lista (colunas ePGR + busca + filtro por tipo + paginação + estado vazio)"
Task: "T010 Form (Tipo→Categoria em cascata) + página de criação"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 Setup → 2. Phase 2 Foundational (`EntityInUseError`) → 3. Phase 3 US1 (T004–T013) → 4. **VALIDAR** US1 isolada (criar/listar/editar/excluir) → 5. demo.

### Incremental Delivery

US1 (MVP, CRUD funcional) → US2 (prova de isolamento) → US3 (prova de coerência Tipo×Categoria) →
US4 (prova de exclusão segura) → Polish. Cada fase adiciona garantia sem quebrar a anterior.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- US2/US3/US4 são fases de **verificação** de propriedades do código entregue na US1 (entidade
  única); cada uma em arquivo de teste próprio para preservar independência.
- Verificar que os testes falham antes de implementar.
- Commit por tarefa ou grupo lógico (push é manual; **sem commit automático**).
- **Sem migration nova; sem alterar schema; sem CRUD de categorias; sem upload físico** (Princípios
  I, II, V; Q1/Q2 do clarify). O modelo é da 008; o `pgr-seed.ts` já tem os dados de dependentes
  para o teste de bloqueio.
