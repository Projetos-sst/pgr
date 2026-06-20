# Tasks: Cadastros base do PGR — fundação de dados (Empresa → Funcionário)

**Input**: Design documents from `.specs/006-cadastros-base-pgr/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (todos presentes)

**Tests**: INCLUÍDOS e obrigatórios — a constituição (Quality Gate) e o `CLAUDE.md` exigem
unitários de regra/validação/agregação + integração de RLS/integridade contra **Postgres
efêmero** (nunca SQLite). Casos críticos multi-tenant são escritos/validados à mão.

**Organization**: Tarefas agrupadas por user story para implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: a qual user story a tarefa pertence (US1–US4)
- Todo caminho de arquivo é relativo à raiz do repositório

## Path Conventions

Projeto único Next.js fullstack, layout `src/` (alias `@/*` → `./src/*`). Schema/repos/
migrations em `src/shared/db/`; validação de domínio em `src/shared/domains/pgr/`; testes em
`src/__tests__/{unit,integration}/…` (espelhando os da `004`/`005`). RLS provada contra
**Postgres efêmero** (`INTEGRATION_DATABASE_URL` / `INTEGRATION_APP_RUNTIME_URL` /
`INTEGRATION_DATABASE_URL_ADMIN`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Garantir baseline e harness antes de tocar schema.

- [X] T001 Confirmar baseline na branch `feature/cadastros-base-pgr`: rodar `npm run lint`, `npx tsc --noEmit`, `npm run test` e `npm run test:integration` verdes com o harness de **Postgres efêmero** da `004`/`005` (`INTEGRATION_*`); sem esses envs os `describe` de RLS ficam `skip` — registrar o estado. Confirmar que `0000`–`0004` aplicam em banco limpo.

**Checkpoint**: Ambiente validado; padrão `tenant_probe`/`companies` provado verde.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema das 7 entidades + migration `0005_*`. **Toda** user story consome isto.

**⚠️ CRITICAL**: Nenhuma user story começa antes desta fase concluída (schema + migration aplicada). Réplica fiel do padrão de RLS de `companies.ts`/`tenant-probe.ts`: `org_id text NOT NULL → orgs.id` indexado, `pgPolicy("<t>_isolation", { for:"all", to: appRuntimeRole, using/withCheck: sql\`org_id = current_setting('app.current_org', true)\` })`, `.enableRLS()`, `updated_at` + trigger. (contract: schema-and-migrations; data-model.md)

- [X] T002 [P] Em `src/shared/db/schema/companies.ts` (ALTER): `razaoSocial` passa a `.notNull()`; adicionar `nomeFantasia/phone/email/cnae/mainActivity` (text), `riskGrade smallint` + `check("companies_risk_grade_check", sql\`risk_grade between 1 and 4\`)`, `logoPath text`, colunas de endereço (`zipCode/street/number/complement/district/city/state` text), `updatedAt timestamptz NOT NULL defaultNow`. Manter `idx_companies_org_id`, `uq_companies_org_id_cnpj` e a policy/GRANT existentes. (data-model §companies)
- [X] T003 [P] Criar `src/shared/db/schema/work-units.ts`: `pgTable("work_units", …)` com convenção comum (`id` uuid PK, `orgId` FK→orgs cascade indexado, `createdAt`, `updatedAt`), `companyId uuid notNull` FK→`companies.id` `onDelete:"cascade"` + `index("idx_work_units_company_id")`, `name*`, `contractNumber`, `description*`, colunas de endereço; `pgPolicy("work_units_isolation", …)`, `.enableRLS()`. Exportar tipos `WorkUnit`/`NewWorkUnit`. (depende de T002 — importa `companies`)
- [X] T004 Criar `src/shared/db/schema/ges.ts`: convenção comum + `companyId*` FK→companies cascade (idx) + `workUnitId*` FK→`work_units.id` cascade (idx), `name*`, `processDescription`, `constructionType`, `ceilingHeight numeric`, `floor`, `roof`, `lighting`, `ventilation`, `otherCharacteristics`; policy `ges_isolation` + `.enableRLS()`. **Nº de expostos NÃO é coluna**. (depende de T002, T003)
- [X] T005 [P] Criar `src/shared/db/schema/job-roles.ts`: convenção comum + `companyId*` FK→companies cascade (idx), `title*`, `cbo`, `workSchedule`, `description`; `uniqueIndex("uq_job_roles_org_company_title").on(orgId, companyId, title)`; policy `job_roles_isolation` + `.enableRLS()`. (depende de T002)
- [X] T006 [P] Criar `src/shared/db/schema/categories.ts`: `pgEnum("category_type", ["epi","machine"])` + convenção comum + `type categoryType notNull`, `name*`, `note`; `uniqueIndex("uq_categories_org_type_name").on(orgId, type, name)`; policy `categories_isolation` + `.enableRLS()`. (sem FK a companies)
- [X] T007 Criar `src/shared/db/schema/employees.ts`: `pgEnum("employee_sex", ["male","female","not_informed"])`, `pgEnum("marital_status", ["single","married","divorced","widowed","stable_union"])`, `pgEnum("employee_status", ["active","on_leave","dismissed"])` + convenção comum + `companyId*` FK→companies cascade (idx), `gesId` FK→`ges.id` `onDelete:"set null"` (idx), `jobRoleId` FK→`job_roles.id` `onDelete:"set null"` (idx), `fullName*`, `cpf*`, `birthDate date`, `sex/maritalStatus`, `phone/email/rg/badgeNumber/badgeValidUntil/registration/bloodType/admissionDate/dismissalDate`, endereço, `photoPath`, `status employeeStatus notNull default 'active'`; `uniqueIndex("uq_employees_org_cpf").on(orgId, cpf)`; policy `employees_isolation` + `.enableRLS()`. (depende de T002, T004, T005)
- [X] T008 Criar `src/shared/db/schema/ges-job-roles.ts`: convenção comum + `gesId*` FK→`ges.id` cascade (idx), `jobRoleId*` FK→`job_roles.id` cascade (idx), `workerCount integer notNull` + `check("ges_job_roles_worker_count_check", sql\`worker_count > 0\`)`, `workSchedule`; `uniqueIndex("uq_ges_job_roles_org_ges_role").on(orgId, gesId, jobRoleId)`; policy `ges_job_roles_isolation` + `.enableRLS()`. (depende de T004, T005)
- [X] T009 Em `src/shared/db/schema/index.ts`: re-exportar as 6 tabelas novas + tipos + os 4 enums (`workUnits`, `ges`, `jobRoles`, `categories`, `employees`, `gesJobRoles`, `categoryType`, `employeeSex`, `maritalStatus`, `employeeStatus`). (depende de T002–T008)
- [X] T010 Gerar migration `0005_*` com `npx drizzle-kit generate`; **editar** o SQL conforme contract §4 (ordem: enums → ALTER companies → tabelas por dependência de FK → índices/constraints → policies) e **acrescentar como SQL custom**: `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO app_runtime;` para as 6 tabelas + `CREATE TRIGGER set_updated_at_<t> … EXECUTE FUNCTION public.set_updated_at();` para as 6 tabelas + `companies`. Se houver linha com `razao_social` nula no alvo, normalizar antes do `SET NOT NULL`. Aplicar com `npx drizzle-kit migrate` (conexão direta/owner `DATABASE_URL_UNPOOLED`). Arquivo em `src/shared/db/migrations/`. (contract §3–§5; depende de T009) — ⚠️ aplicação a banco hospedado requer autorização (guardrail de mutação de DB); preferir Postgres efêmero/local.

**Checkpoint**: 6 tabelas novas + `companies` migradas com RLS/GRANT/trigger; foundation pronta.

---

## Phase 3: User Story 1 — Isolamento multi-tenant em toda tabela de cadastro (Priority: P1) 🎯 MVP

**Goal**: Cada tabela nova + `companies` isola por `org_id` (RLS backstop `app_runtime`): tenant A só vê A; sem tenant ativo → vazio; tenant inválido → vazio; escrita cross-tenant rejeitada por `WITH CHECK`; escopo não vaza fora da transação. (FR-008..012; SC-001..004)

**Independent Test**: Contra **Postgres efêmero**, por tabela: inserir em A e B, fixar A via `withOrgTx` → só A; query bare sem tenant → 0; `withOrgTx('org_inexistente')` → 0; inserir `org_id=B` sob A → rejeitado.

### Tests for User Story 1 ⚠️ (escrever ANTES; devem falhar — espelhar `companies-isolation.test.ts`)

- [X] T011 [P] [US1] Integração RLS `src/__tests__/integration/shared/db/work-units-isolation.test.ts` (A só vê A; B só vê B; bare → 0; inválido → 0; write cross-tenant rejeitada; escopo não vaza). `describe.skip` sem `INTEGRATION_*`.
- [X] T012 [P] [US1] Integração RLS `src/__tests__/integration/shared/db/ges-isolation.test.ts` (mesmas asserções).
- [X] T013 [P] [US1] Integração RLS `src/__tests__/integration/shared/db/job-roles-isolation.test.ts`.
- [X] T014 [P] [US1] Integração RLS `src/__tests__/integration/shared/db/categories-isolation.test.ts`.
- [X] T015 [P] [US1] Integração RLS `src/__tests__/integration/shared/db/employees-isolation.test.ts`.
- [X] T016 [P] [US1] Integração RLS `src/__tests__/integration/shared/db/ges-job-roles-isolation.test.ts`.

### Implementation for User Story 1

- [X] T017 [P] [US1] Criar os repositórios CRUD org-scoped em `src/shared/db/repositories/` (`work-units.ts`, `ges.ts`, `job-roles.ts`, `categories.ts`, `employees.ts`, `ges-job-roles.ts`): leitura/escrita **dentro** de `withOrg(tenantId, tx)`, `where eq(org_id, tenant)` como 1ª barreira, insert fixando `orgId` = tenant ativo (nunca de input do cliente). Padrão `contracts/repositories-and-validation §1`. (schema/GRANT de Foundational)

**Checkpoint**: US1 funcional e testável isoladamente — MVP. Isolamento provado por tabela.

---

## Phase 4: User Story 2 — Integridade e unicidade dos cadastros (Priority: P1)

**Goal**: A cadeia só aceita dados consistentes: FKs íntegras com `ON DELETE` previsível; `UNIQUE(org_id, cpf)`; CNPJ não global; enums fechados; `risk_grade ∈ 1..4`; `worker_count > 0`; demais `UNIQUE`. (FR-013..018; SC-005..009)

**Independent Test**: Contra **Postgres efêmero**: CPF dup na mesma org rejeitado, em orgs distintas aceito; mesmo CNPJ em A e B coexiste; FK inválida na cadeia rejeitada; enum/`risk_grade`/`worker_count` fora do domínio rejeitados; apagar empresa cascateia filhos; apagar GES/função faz `SET NULL` no funcionário.

### Tests for User Story 2 ⚠️ (escrever ANTES; devem falhar)

- [X] T018 [P] [US2] Integração `src/__tests__/integration/shared/db/pgr-chain-integrity.test.ts`: FK válida ao longo de `companies → work_units → ges → ges_job_roles ← job_roles` e `employees → (company, ges, job_role)`; FK inválida em cada elo rejeitada; apagar `companies` cascateia `work_units`/`ges`/`ges_job_roles`/`employees`; apagar `ges`/`job_roles` referenciado por `employees` → `SET NULL` (funcionário permanece). (FR-013/014; SC-007/009)
- [X] T019 [P] [US2] Integração `src/__tests__/integration/shared/db/pgr-constraints.test.ts`: `UNIQUE(org_id, cpf)` bloqueia dup intra-org e permite mesmo CPF em orgs distintas; mesmo `cnpj` em A e B coexiste (sem único global); `UNIQUE(org_id, ges_id, job_role_id)` e `UNIQUE(org_id, company_id, title)` e `UNIQUE(org_id, type, name)` ativos; `worker_count <= 0` e `risk_grade` fora de 1..4 rejeitados; valor de enum inválido rejeitado. (FR-015..018; SC-005/006/008)
- [X] T020 [P] [US2] Unit `src/__tests__/unit/domains/pgr/validation.test.ts`: schemas zod — membros de enum aceitos/rejeitados; `riskGradeSchema` (1..4); `workerCountSchema` (> 0); formato de `cpf`/`cnpj`. (FR-024)

### Implementation for User Story 2

- [X] T021 [US2] Criar `src/shared/domains/pgr/validation.ts`: schemas zod de domínio (`categoryTypeSchema`, `employeeSexSchema`, `maritalStatusSchema`, `employeeStatusSchema`, `riskGradeSchema`, `workerCountSchema`, formato `cpf`/`cnpj`) reutilizados pelos repositórios na entrada (antes da regra). A unicidade/FK permanece garantida pelo banco; o repositório propaga o erro do banco como erro de domínio. (contract: repositories-and-validation §3)

**Checkpoint**: US1 + US2 verdes — schema, isolamento e integridade da cadeia provados.

---

## Phase 5: User Story 3 — Nº de trabalhadores expostos por GES (derivado) (Priority: P2)

**Goal**: Nº de expostos por GES = `SUM(worker_count)` de `ges_job_roles` por agregação na leitura; 0 sem associações; reflete imediatamente add/update/delete; soma só do tenant ativo. (FR-019/020; SC-010/011)

**Independent Test**: GES sem associação → 0; com associações → soma; alterar associação → nova soma na próxima leitura; agregação não cruza tenants.

### Tests for User Story 3 ⚠️ (escrever ANTES; devem falhar)

- [X] T022 [P] [US3] Unit `src/__tests__/unit/domains/pgr/exposed-workers.test.ts`: lógica de agregação com `tx` mockado — `coalesce(sum, 0)` → **0** quando vazio; soma correta; nunca nulo/erro.
- [X] T023 [P] [US3] Integração `src/__tests__/integration/shared/db/exposed-workers.test.ts` (Postgres efêmero): GES sem associação → 0; criar associações com `worker_count` 3 e 2 → 5; remover uma → 3; alterar → reflete; associações de outro tenant não entram na soma. (SC-010/011)

### Implementation for User Story 3

- [X] T024 [US3] Em `src/shared/db/repositories/ges.ts`: `countExposedWorkersByGes(orgId, gesId): Promise<number>` (`select coalesce(sum(worker_count),0)::int … where org_id and ges_id`, dentro de `withOrg`) e `exposedWorkersByGesMap(orgId)` (`LEFT JOIN ges_job_roles`, 0 inclusive). Fonte única `ges_job_roles`, sem coluna/trigger. (contract §2; depende de T017)

**Checkpoint**: US1+US2+US3 verdes; derivação do nº de expostos sem drift.

---

## Phase 6: User Story 4 — Fundação de schema versionada e padronizada (Priority: P3)

**Goal**: A migration `0005_*` sobe sem erro num Postgres limpo (com `0000`–`0004`), criando as 6 tabelas com o padrão canônico (RLS/policy/GRANT/índice/`updated_at`+trigger) + enums + CHECKs, e alterando `companies` (`razao_social NOT NULL`). (FR-021/022; SC-012)

> **Nota de ordem**: a entrega da migration é **Foundational (T010)** — é ela que bloqueia todas as P1. Esta story (P3) apenas **prova a forma/conformidade** do que a Foundational produziu; não há trabalho de schema novo aqui.

**Independent Test**: Aplicar `0000`–`0005` em banco efêmero e introspectar o catálogo: tabelas existem, RLS habilitado, policy `<t>_isolation` `TO app_runtime`, GRANTs, trigger `set_updated_at_<t>`, enums e CHECKs presentes; `update` em qualquer linha bumpa `updated_at`.

### Tests for User Story 4 ⚠️ (escrever ANTES; devem falhar)

- [X] T025 [P] [US4] Integração `src/__tests__/integration/shared/db/migration-shape.test.ts` (Postgres efêmero): após `applyMigrations`, para cada tabela nova — `relrowsecurity=true`; existe policy `<t>_isolation` para `app_runtime`; `app_runtime` tem GRANT `SELECT/INSERT/UPDATE/DELETE`; existe trigger `set_updated_at_<t>`; `pg_type` tem os 4 enums com os membros esperados; `companies.razao_social` é `NOT NULL`. Um `UPDATE` numa linha avança `updated_at`. (SC-012)

### Implementation for User Story 4

- [X] T026 [US4] Sem código novo de produto — a entrega estrutural vem da Foundational (T002–T010). Confirmar via T025 que o padrão (RLS/GRANT/trigger/enum/CHECK) foi replicado em **todas** as 6 tabelas e em `companies`; registrar no `quickstart.md` qualquer ajuste do SQL custom necessário.

**Checkpoint**: Migration aplica limpa e o precedente de padrões está provado.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Auditoria, gate e validação final da fatia.

- [X] T027 [P] Auditoria (FR-025): garantir que a **rejeição cross-tenant pelo banco** (`WITH CHECK`) nos repositórios novos emite `logTenantEvent` com correlação (`requestId`, `orgId`, `userId`, `operation`) e **sem** PII (sem `cpf`, nomes). Reutilizar `src/shared/tenant/audit-log.ts`. _O bloqueio por falta de tenant ativo é herdado de `requireTenantContext()` da `005` — não há novo caminho de bloqueio nesta fatia._
- [ ] T028 Quality Gate (constituição): `npm run lint`, `npx tsc --noEmit`, `npm run test` e `npm run test:integration` — todos verdes. **DoD não é cumprida com os `describe` de RLS em `skip`**: o gate exige `INTEGRATION_*` presente e os testes de isolamento/integridade/forma da migration **efetivamente executando** (skip = falha do gate, conforme spec §Definição de pronto e constituição §Quality Gate).
- [ ] T029 Validação do `quickstart.md` (5 passos) contra Postgres efêmero/local: gerar/aplicar `0005_*`; rodar a matriz de testes (isolamento por tabela, integridade/unicidade, agregação) **executando** (não `skip`) e verde. — ⚠️ requer a migration aplicada (T010) e ambiente com DB + `INTEGRATION_*`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup; **bloqueia todas** as user stories. Ordem interna de import/FK: T002 → T003 → T004; T002 → T005; T004/T005 → T007; T004/T005 → T008; T006 independente; T002–T008 → T009 → T010 (migration).
- **User Stories (Phase 3+)**: todas dependem da Foundational (schema migrado).
  - US1 (isolamento) e US2 (integridade) dependem só do schema — podem ser paralelas.
  - US3 (agregação) depende dos repos de US1 (T017) para `repositories/ges.ts`.
  - US4 (forma da migration) depende só da Foundational.
- **Polish (Phase 7)**: depende das stories desejadas concluídas.

### User Story Dependencies

- **US1 (P1)**: após Foundational. Entrega os repositórios org-scoped (T017).
- **US2 (P1)**: após Foundational. Independente de US1 (testes em SQL cru + zod).
- **US3 (P2)**: após Foundational; estende `repositories/ges.ts` (após T017 de US1).
- **US4 (P3)**: após Foundational. Sem dependência de outras stories.

### Within Each User Story

- Testes escritos e **falhando** antes da implementação (TDD nos casos críticos multi-tenant).
- Schema (Foundational) antes de repositório; repositório antes da agregação/validação.

### Parallel Opportunities

- Foundational: T002, T003, T005, T006 em arquivos distintos podem iniciar em paralelo (respeitando os imports de FK: T004/T007/T008 aguardam suas dependências).
- US1: os 6 testes de isolamento (T011–T016) em paralelo; T017 [P] em paralelo aos testes.
- US2: T018/T019/T020 em paralelo.
- Stories P1 entre si: US1 e US2 podem rodar em paralelo após a Foundational.

---

## Parallel Example: User Story 1

```bash
# Testes de isolamento de US1 juntos (devem falhar primeiro):
Task: "work-units-isolation.test.ts (RLS A/B, sem tenant vazio, cross rejeitada)"
Task: "ges-isolation.test.ts"
Task: "job-roles-isolation.test.ts"
Task: "categories-isolation.test.ts"
Task: "employees-isolation.test.ts"
Task: "ges-job-roles-isolation.test.ts"

# Implementação (arquivo distinto):
Task: "6 repositórios CRUD org-scoped em src/shared/db/repositories/ (withOrg)"
```

---

## Implementation Strategy

### MVP First (P1: US1 + US2)

1. Phase 1 (Setup) → Phase 2 (Foundational, CRÍTICA — schema + migration `0005_*`).
2. US1 (isolamento por tabela) → **STOP & VALIDATE** (RLS provado contra Postgres efêmero).
3. US2 (integridade/unicidade) → validar FK/`ON DELETE`/`UNIQUE`/`CHECK`/enum.
4. As duas P1 verdes = núcleo da fatia entregável.

### Incremental Delivery

- P1 (US1/US2) entrega o núcleo (isolamento + integridade das 7 tabelas).
- P2 (US3) adiciona a derivação do nº de expostos sem tocar o schema.
- P3 (US4) prova a forma/padrão da migration (precedente do PGR).

### Notas

- **Fora desta fatia** (YAGNI / fatias futuras): UI/formulários, lookup de CNPJ, ViaCEP,
  upload de logo/foto (só `*_path`), tabela de CBO, vínculo com `training_catalog`, CNH/
  passaporte/contatos de emergência, Server Actions de CRUD com interface, vínculo
  `employees`↔`risks`. Ver `spec.md` → Out of Scope.
- RLS/integridade **nunca** em SQLite — provadas contra Postgres efêmero (`INTEGRATION_*`).
  Validação zod e agregação (lógica) rodam no projeto `unit`.
- **Decisão confirmada**: `UNIQUE(org_id, type, name)` em `categories` está registrada na
  spec (Clarifications 2026-06-19 + FR-017) e em R6 — não é mais decisão em aberto.
- Commit por tarefa ou grupo lógico; parar em qualquer checkpoint para validar a story isolada.
