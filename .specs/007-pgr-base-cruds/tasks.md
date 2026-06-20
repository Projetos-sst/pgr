---
description: "Task list — CRUDs base do PGR (spec 007)"
---

# Tasks: CRUDs dos cadastros base do PGR

**Input**: Design documents from `.specs/007-pgr-base-cruds/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Tests**: OBRIGATÓRIOS (constituição + CLAUDE.md + SC-007). Unit + integração; isolamento contra Postgres efêmero.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1..US5 (mapeia as user stories da spec)
- Caminhos de arquivo são relativos à raiz do repositório

**Convenções herdadas (não reinventar)**: repositórios em `src/shared/db/repositories/` usam
`withOrg(tenantId, …)` + `auditedTenantWrite`; validação reusa `src/shared/domains/pgr/validation.ts`;
derivação reusa `src/shared/domains/pgr/exposed-workers.ts`; isolamento testado com
`src/__tests__/integration/_helpers/` (`runIsolationSuite`, `pgr-seed.ts`). **Sem migration nova.**

**Convenções de página (aplicam-se a TODA página desta fatia — Server Components):**
- **Gate de papel (FR-065/SC-008)**: toda página de lista/detalhe/edição/criação chama
  `requireOfficeStaff()` no topo e, na negação, usa `forbidden()` do Next 16 (`app/forbidden.tsx`
  já existe). Vale para **leitura** também — `client` é negado em qualquer rota da fatia.
- **404 cross-tenant (FR-003/SC-006)**: páginas de detalhe/edição que carregam por id chamam
  `notFound()` quando o `getById*` retorna `null` (id inexistente ou de outro escritório).
- **Auditoria**: `logTenantEvent`/`auditedTenantWrite` apenas nas **escritas** (criar/editar/
  excluir e mutações de vínculo); leituras não emitem evento de auditoria (FR-064).

---

## Phase 1: Setup (estrutura compartilhada)

- [X] T001 Criar a estrutura de pastas da fatia: `src/shared/server/actions/pgr/`, rotas
  `src/app/(protected)/{companies,work-units,job-roles,ges,employees}/`, e diretórios de teste
  `src/__tests__/unit/domains/pgr/` e `src/__tests__/integration/pgr/` (com `.gitkeep` onde vazio).

---

## Phase 2: Foundational (pré-requisitos bloqueantes)

**⚠️ CRÍTICO**: nenhuma user story começa antes desta fase. Estabelece o contrato de retorno, o
gate de papel, o mapeamento de erros e a paginação — reusados pelas 5 entidades.

- [X] T002 [P] Implementar `ActionResult<T>`, `ok()`, `fail()` em `src/shared/server/result.ts` (conforme `contracts/action-result.md`).
- [X] T003 [P] Adicionar `ForbiddenError` (`code "FORBIDDEN"`, `status 403`) em `src/shared/auth/errors.ts`.
- [X] T004 Implementar `requireOfficeStaff()` em `src/shared/auth/require-office-staff.ts` — usa `requireTenantContext()`, permite `owner`/`collaborator`, lança `ForbiddenError` para `client` (depende de T003).
- [X] T005 Implementar mapeamento de erro → `ActionResult` (`ZodError`→`VALIDATION` com `fields`; UNIQUE→`DUPLICATE`; FK→`FK_NOT_FOUND`; `AppError` conhecidos→code; inesperado relançado+`logTenantEvent`) em `src/shared/server/action-error.ts` (depende de T002).
- [X] T006 [P] Adicionar utilitário de paginação (`Paginated<T>`, `resolvePageParams({page,pageSize})` com `pageSize` padrão 20, **coerção `page>=1`** e **clamp de `pageSize` a um máximo (`PAGE_SIZE_MAX = 100`)**; entradas inválidas/negativas caem nos defaults) em `src/shared/db/pagination.ts`.
- [X] T007 [P] Unit: `ActionResult`/`ok`/`fail` + mapeamento de erro em `src/__tests__/unit/shared/server/action-error.test.ts`; **e `resolvePageParams` (default 20, `page>=1`, clamp `pageSize≤100`, entradas inválidas → default)** em `src/__tests__/unit/shared/db/pagination.test.ts` (depende de T002, T005, T006).
- [X] T008 [P] Unit: `requireOfficeStaff` (owner/collaborator passam; client → `ForbiddenError`) em `src/__tests__/unit/shared/auth/require-office-staff.test.ts` (depende de T004).

**Checkpoint**: contrato + autorização + paginação prontos — as user stories podem começar.

---

## Phase 3: User Story 1 — CRUD de Empresa (Priority: P1) 🎯 MVP

**Goal**: CRUD completo de Empresa-cliente (raiz da cadeia) com todos os campos da 006.

**Independent Test**: criar empresa (razão social + risk_grade 1–4) → ver na lista paginada →
abrir edição → editar → excluir com aviso de cascata; tudo escopado ao tenant; id de outro
escritório → 404.

### Tests for User Story 1 ⚠️ (escrever antes da implementação)

- [X] T009 [P] [US1] Unit: `CompanyInput` (razão social obrigatória, `risk_grade` 1..4, CNPJ 14 díg. quando preenchido) + mapeadores DTO (`toCompanyListItem`) em `src/__tests__/unit/domains/pgr/companies.test.ts`.
- [X] T010 [P] [US1] Integração: actions de empresa (create/list/detail/update/delete; CNPJ dup→`DUPLICATE`; risk_grade fora→`VALIDATION`; detalhe cross-tenant→`NOT_FOUND`; papel `client`→`FORBIDDEN`) em `src/__tests__/integration/pgr/companies.test.ts`.
- [X] T011 [P] [US1] Integração de isolamento: `companies` (A só vê A; escrita cross-tenant rejeitada; `uq_companies_org_id_cnpj` aceita mesmo CNPJ em orgs distintas, bloqueia no mesmo) reusando `runIsolationSuite` em `src/__tests__/integration/pgr/companies-isolation.test.ts`.

### Implementation for User Story 1

- [X] T012 [P] [US1] Estender `src/shared/db/repositories/companies.ts`: `listCompanies({search,page,pageSize})→Paginated`, `getCompanyById`, `createCompany` (TODOS os campos da 006), `updateCompany`, `deleteCompany`, `countCompanyDependents`.
- [X] T013 [P] [US1] `CompanyInput` (zod, compõe `cnpjSchema`/`riskGradeSchema`) + DTOs (`CompanyListItem`, `toCompanyListItem`) em `src/shared/domains/pgr/companies.ts`.
- [X] T014 [US1] Server Actions de empresa (`list/get/create/update/delete/dependents`, `requireOfficeStaff`→zod→repo→`revalidatePath`) em `src/shared/server/actions/pgr/companies.ts` (depende de T012, T013, Phase 2).
- [X] T015 [P] [US1] Página de lista paginada + busca + estado vazio em `src/app/(protected)/companies/page.tsx` (`requireOfficeStaff()`→`forbidden()`; convenções de página).
- [X] T016 [P] [US1] Formulário de criação em `src/app/(protected)/companies/new/page.tsx` (Client Component que exibe `error.fields`; gate de papel).
- [X] T017 [P] [US1] Detalhe=edição em `src/app/(protected)/companies/[id]/edit/page.tsx` (`getCompanyById` null → `notFound()`; gate de papel).
- [X] T018 [US1] Confirmação de exclusão com aviso de cascata (consome `dependents`) em `src/app/(protected)/companies/_components/delete-company.tsx` (depende de T014).

**Checkpoint**: Empresa CRUD completo, isolado e testável — MVP entregável.

---

## Phase 4: User Story 2 — CRUD de Unidade de Obra (Priority: P1)

**Goal**: CRUD completo de Unidade de Obra por empresa, com "copiar endereço da empresa".

**Independent Test**: com empresa existente, criar obra (nome+objeto+empresa) → lista → editar →
"copiar endereço" (desabilitado se empresa sem endereço) → excluir com aviso de GES vinculados.

### Tests for User Story 2 ⚠️

- [X] T019 [P] [US2] Unit: `WorkUnitInput` (nome/objeto/empresa obrigatórios) + DTO em `src/__tests__/unit/domains/pgr/work-units.test.ts`.
- [X] T020 [P] [US2] Integração: actions de obra (CRUD; empresa de outro tenant não selecionável/`FK_NOT_FOUND`; 404 cross-tenant; `client`→`FORBIDDEN`) em `src/__tests__/integration/pgr/work-units.test.ts`.
- [X] T021 [P] [US2] Isolamento `work_units` via `runIsolationSuite` em `src/__tests__/integration/pgr/work-units-isolation.test.ts`.

### Implementation for User Story 2

- [X] T022 [P] [US2] Estender `src/shared/db/repositories/work-units.ts`: `listWorkUnits({companyId,search,page,pageSize})→Paginated`, `getWorkUnitById`, `updateWorkUnit`, `deleteWorkUnit`, `countWorkUnitDependents` (GES).
- [X] T023 [P] [US2] `WorkUnitInput` (zod) + DTOs em `src/shared/domains/pgr/work-units.ts`.
- [X] T024 [US2] Server Actions de obra (`list/get/create/update/delete/dependents`) em `src/shared/server/actions/pgr/work-units.ts` (depende de T022, T023).
- [X] T025 [P] [US2] Lista paginada + filtro por empresa + busca em `src/app/(protected)/work-units/page.tsx` (gate de papel; convenções de página).
- [X] T026 [P] [US2] Form criar/editar com seletor de empresa (só do tenant) e ação "copiar endereço da empresa" (habilitada só se a empresa tiver endereço) em `src/app/(protected)/work-units/new/page.tsx` e `src/app/(protected)/work-units/[id]/edit/page.tsx` (edição: `getWorkUnitById` null → `notFound()`; gate de papel).
- [X] T027 [US2] Confirmação de exclusão com aviso de GES vinculados em `src/app/(protected)/work-units/_components/delete-work-unit.tsx` (depende de T024).

**Checkpoint**: US1 e US2 funcionam independentemente.

---

## Phase 5: User Story 3 — CRUD de Função/Cargo (Priority: P1)

**Goal**: CRUD completo de Função (com CBO texto livre) por empresa.

**Independent Test**: criar função (título+empresa) → lista com busca título/CBO → editar →
excluir com aviso de impacto (vínculos de GES / funcionários).

### Tests for User Story 3 ⚠️

- [X] T028 [P] [US3] Unit: `JobRoleInput` (título/empresa obrigatórios) + DTO em `src/__tests__/unit/domains/pgr/job-roles.test.ts`.
- [X] T029 [P] [US3] Integração: actions de função (CRUD; título dup na mesma empresa→`DUPLICATE`; mesmo título em empresas diferentes permitido; 404 cross-tenant; `client`→`FORBIDDEN`) em `src/__tests__/integration/pgr/job-roles.test.ts`.
- [X] T030 [P] [US3] Isolamento `job_roles` via `runIsolationSuite` em `src/__tests__/integration/pgr/job-roles-isolation.test.ts`.

### Implementation for User Story 3

- [X] T031 [P] [US3] Estender `src/shared/db/repositories/job-roles.ts`: `listJobRoles({companyId,search,page,pageSize})→Paginated`, `getJobRoleById`, `updateJobRole`, `deleteJobRole`, `countJobRoleDependents` (gesLinks, employees).
- [X] T032 [P] [US3] `JobRoleInput` (zod) + DTOs em `src/shared/domains/pgr/job-roles.ts`.
- [X] T033 [US3] Server Actions de função (`list/get/create/update/delete/dependents`) em `src/shared/server/actions/pgr/job-roles.ts` (depende de T031, T032).
- [X] T034 [P] [US3] Lista paginada + busca título/CBO + filtro por empresa em `src/app/(protected)/job-roles/page.tsx` (gate de papel; convenções de página).
- [X] T035 [P] [US3] Form criar/editar em `src/app/(protected)/job-roles/new/page.tsx` e `src/app/(protected)/job-roles/[id]/edit/page.tsx` (edição: `getJobRoleById` null → `notFound()`; gate de papel).
- [X] T036 [US3] Confirmação de exclusão com aviso de impacto (vínculos/funcionários) em `src/app/(protected)/job-roles/_components/delete-job-role.tsx` (depende de T033).

**Checkpoint**: US1–US3 independentes e testáveis.

---

## Phase 6: User Story 4 — CRUD de GES + gestão das funções vinculadas (Priority: P1)

**Goal**: CRUD de GES (cascata empresa→obra) + gerenciar `ges_job_roles` (add/editar/remover),
com nº de expostos derivado (somente leitura) e card "Total".

**Independent Test**: criar GES (empresa→obra) → adicionar função (worker_count>0) → expostos =
soma → editar/remover vínculo → soma recalcula; sem obras → criação bloqueada; vínculo duplicado
→ bloqueado; excluir GES → vínculos somem e funcionários ficam com GES nulo (aviso).

### Tests for User Story 4 ⚠️

- [X] T037 [P] [US4] Unit: `GesInput` (name/company/work_unit), `GesJobRoleInput` (worker_count>0 via `workerCountSchema`), DTOs (`GesListItem`) e derivação (0 sem vínculo, soma) em `src/__tests__/unit/domains/pgr/ges.test.ts`.
- [X] T038 [P] [US4] Integração: actions de GES + vínculos (create/list/detail/update/delete; add/update/remove vínculo; worker_count≤0→`VALIDATION`; vínculo dup→`DUPLICATE`; available-roles exclui já vinculadas; total/expostos não cruzam tenant; 404 cross-tenant; `client`→`FORBIDDEN`) em `src/__tests__/integration/pgr/ges.test.ts`.
- [X] T039 [P] [US4] Isolamento `ges` e `ges_job_roles` via `runIsolationSuite` em `src/__tests__/integration/pgr/ges-isolation.test.ts`.

### Implementation for User Story 4

- [X] T040 [P] [US4] Estender `src/shared/db/repositories/ges.ts`: `listGes({companyId,workUnitId,search,page,pageSize})→Paginated & {totalWorkers}` (usa `exposedWorkersByGesMap`), `getGesById`, `updateGes`, `deleteGes`.
- [X] T041 [P] [US4] Estender `src/shared/db/repositories/ges-job-roles.ts`: `listGesJobRoles({gesId})` (join `job_roles` p/ título), `listAvailableJobRolesForGes(gesId,companyId)`, `updateGesJobRole`, `deleteGesJobRole`.
- [X] T042 [P] [US4] `GesInput`/`GesJobRoleInput` (zod) + DTOs em `src/shared/domains/pgr/ges.ts`.
- [X] T043 [US4] Server Actions de GES + vínculos (`list/get/create/update/delete` + `listGesJobRoles/listAvailableJobRoles/addGesJobRole/updateGesJobRole/removeGesJobRole`) em `src/shared/server/actions/pgr/ges.ts` (depende de T040, T041, T042).
- [X] T044 [P] [US4] Lista de GES paginada + filtros empresa/obra + card "Total de Trabalhadores" + busca em `src/app/(protected)/ges/page.tsx` (gate de papel; convenções de página).
- [X] T045 [P] [US4] Form criar/editar GES com seleção em cascata empresa→obra (bloqueia criação se empresa sem obras) e nº de expostos somente leitura em `src/app/(protected)/ges/new/page.tsx` e `src/app/(protected)/ges/[id]/edit/page.tsx` (edição: `getGesById` null → `notFound()`; gate de papel).
- [X] T046 [US4] Painel "Gerenciar funções do GES" (adicionar com seletor de funções não vinculadas + worker_count; editar; remover; expostos reflete a soma) em `src/app/(protected)/ges/[id]/_components/manage-functions.tsx` (depende de T043).
- [X] T047 [US4] Confirmação de exclusão de GES com aviso (vínculos em cascata; funcionários desvinculados) em `src/app/(protected)/ges/_components/delete-ges.tsx` (depende de T043).

**Checkpoint**: GES + vínculos completos; expostos derivado consistente.

---

## Phase 7: User Story 5 — CRUD de Funcionário (Priority: P1)

**Goal**: CRUD completo de Funcionário (empresa obrigatória; GES/Função opcionais; picker de
Função filtrado pelo GES), lista filtrável e ficha de detalhe.

**Independent Test**: criar funcionário (nome+CPF+empresa) → lista (filtro empresa/status, busca)
→ ficha de detalhe → editar → selecionar GES → picker mostra só funções do GES → excluir; CPF
dup no mesmo tenant bloqueado, mesmo CPF em outro tenant aceito; 404 cross-tenant.

### Tests for User Story 5 ⚠️

- [X] T048 [P] [US5] Unit: `EmployeeInput` (full_name/cpf/company obrigatórios; enums fechados; CPF 11 díg.) + DTO (`EmployeeListItem`) em `src/__tests__/unit/domains/pgr/employees.test.ts`.
- [X] T049 [P] [US5] Integração: actions de funcionário (CRUD; CPF dup→`DUPLICATE`; CPF inválido/enum fora→`VALIDATION`; picker de função só do GES; salvar sem GES/função; 404 cross-tenant; `client`→`FORBIDDEN`) em `src/__tests__/integration/pgr/employees.test.ts`.
- [X] T050 [P] [US5] Isolamento `employees` via `runIsolationSuite` (mesmo CPF em orgs distintas vs. bloqueio no mesmo) em `src/__tests__/integration/pgr/employees-isolation.test.ts`.

### Implementation for User Story 5

- [X] T051 [P] [US5] Estender `src/shared/db/repositories/employees.ts`: `listEmployees({companyId,status,search,page,pageSize})→Paginated` (join GES/Obra/Empresa), `getEmployeeById`, `updateEmployee` (revalida cpf/enums), `deleteEmployee`.
- [X] T052 [P] [US5] `EmployeeInput` (zod, compõe `cpfSchema`/enums) + DTOs em `src/shared/domains/pgr/employees.ts`.
- [X] T053 [US5] Server Actions de funcionário (`list/get/create/update/delete` + `listGesFunctionsAction(gesId)` para o picker — reusa o repositório `listGesJobRoles` de T041, nome canônico) em `src/shared/server/actions/pgr/employees.ts` (depende de T051, T052, T041).
- [X] T054 [P] [US5] Lista paginada com filtro empresa/status + busca nome/GES/função em `src/app/(protected)/employees/page.tsx` (gate de papel; convenções de página).
- [X] T055 [P] [US5] Ficha de detalhe (lotação + placeholders EPI/Histórico/OS) em `src/app/(protected)/employees/[id]/page.tsx` (`getEmployeeById` null → `notFound()`; gate de papel).
- [X] T056 [US5] Form criar/editar (abas Geral / Endereço e Contato) com picker de Função filtrado pelo GES selecionado em `src/app/(protected)/employees/new/page.tsx` e `src/app/(protected)/employees/[id]/edit/page.tsx` (edição: `getEmployeeById` null → `notFound()`; gate de papel; depende de T053).
- [X] T057 [US5] Confirmação de exclusão em `src/app/(protected)/employees/_components/delete-employee.tsx` (depende de T053).

**Checkpoint**: todas as 5 user stories independentes e funcionais.

---

## Phase 8: Polish & Cross-Cutting

- [X] T058 [P] Estender o seed de integração (`src/__tests__/integration/_helpers/pgr-seed.ts`) e/ou `runIsolationSuite` para os novos cenários de escrita/contagem, se necessário.
- [X] T059 [P] Navegação entre os 5 módulos na área protegida (links no layout/menu) em `src/app/(protected)/layout.tsx` (ou componente de navegação).
- [X] T060 Revisar consistência de `revalidatePath` + `logTenantEvent` (sem PII) em todas as Server Actions de `src/shared/server/actions/pgr/`.
- [X] T061 Quality gate: `npm run lint` e `npm run typecheck` verdes (sem `any` injustificado).
- [X] T062 Rodar `npm run test` e `npm run test:integration` (com `INTEGRATION_*` apontando p/ Postgres efêmero) — validar SC-001..SC-009 conforme `quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (P1)**: sem dependências.
- **Foundational (P2)**: depende do Setup; **bloqueia todas as user stories** (ActionResult, requireOfficeStaff, mapeamento de erro, paginação).
- **User Stories (P3–P7)**: dependem da Foundational. Após ela, podem ser feitas em paralelo por pessoas diferentes (são independentemente testáveis com dados semeados).
- **Polish (P8)**: depende das stories desejadas concluídas.

### User Story Dependencies (independência preservada)
- **US1 Empresa**: só Foundational. É o MVP.
- **US2 Obra / US3 Função / US5 Funcionário**: só Foundational; em runtime referenciam uma empresa (FK), mas são testáveis isoladamente com empresa semeada.
- **US4 GES**: só Foundational; usa empresa+obra+função em runtime; reusa a query de funções disponíveis (T041) que US5 também consome (T053).

### Within Each User Story
- Tests primeiro (devem falhar) → repositório → domínio (schema/DTO) → Server Actions → UI.
- Repositório/domínio antes das actions; actions antes da UI e dos componentes de exclusão.

### Parallel Opportunities
- Foundational: T002, T003, T006 em paralelo; T007/T008 em paralelo após suas deps.
- Dentro de cada story: os testes [P] juntos; repositório + domínio [P] juntos; páginas [P] juntas.
- Entre stories: após a Foundational, US1–US5 em paralelo por diferentes devs.

---

## Parallel Example: User Story 1

```bash
# Testes da US1 (escrever antes; devem falhar):
Task: "T009 Unit: company schema + DTO"
Task: "T010 Integração: company actions"
Task: "T011 Isolamento: companies"

# Repositório + domínio em paralelo:
Task: "T012 Estender repositório de companies"
Task: "T013 CompanyInput + DTOs"

# Páginas em paralelo (após T014 actions):
Task: "T015 Lista" ; Task: "T016 Criar" ; Task: "T017 Editar"
```

---

## Implementation Strategy

### MVP First (US1)
1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 Empresa → 4. **VALIDAR** US1 isolada → 5. demo.

### Incremental Delivery
Foundational → US1 (MVP) → US2 → US3 → US4 → US5, cada uma testada e demonstrável sem quebrar as anteriores. Polish ao final.

---

## Notes
- `[P]` = arquivos diferentes, sem dependência pendente.
- Cada story é independentemente completável e testável (com dados semeados).
- Verificar que os testes falham antes de implementar.
- Commit por tarefa ou grupo lógico (push é manual).
- Sem migration nova; sem nova infraestrutura (Princípios I, II, V).
