---
description: "Task list for Módulo de Treinamentos (Fase 04)"
---

# Tasks: Módulo de Treinamentos (Fase 04)

**Input**: Design documents from `.specs/017-training-module/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUÍDOS — a constituição (Princípio V) e a spec exigem testes unitários (lógica/validação) e
de integração (Server Actions/Route Handlers) contra **Postgres efêmero** (`INTEGRATION_*`, nunca
SQLite). Abordagem TDD nas funções puras e nos contratos críticos.

**Organization**: agrupado por história. Fundação (#28) é a fase bloqueante; US1–US4 são fatias
verticais independentes e testáveis isoladamente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1/US2/US3/US4 (fases de história); Setup/Fundação/Polish sem label
- Caminhos de arquivo são relativos à raiz do repositório

## Path Conventions

Web app fullstack Next.js. Código em `src/**`; testes em `src/__tests__/{unit,integration}/`; docs de API
em `docs/api/`. Sem novas pastas de padrão — replica a topologia de `companies`/EPI.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: preparar os módulos-alvo. Nenhuma dependência nova (infra de tenant/gate/erros já existe).

- [x] T001 Confirmar base: branch `feature/training-module` a partir de `develop` (última migration
      `0014`), `npm run check` verde antes de começar; nenhuma dependência npm nova a instalar
- [x] T002 [P] Criar o módulo de domínio vazio `src/shared/domains/pgr/trainings.ts` (arquivo-âncora de
      enum, funções puras e schemas Zod — preenchido na Fundação)
- [x] T003 [P] Criar o módulo de schema vazio `src/shared/db/schema/trainings.ts` (preenchido na Fundação)

---

## Phase 2: Foundational (#28 — Fundação, BLOQUEANTE) 🚧 Migration `0016`

**Purpose**: modelo de dados + as 2 funções puras que todas as histórias consomem.

**⚠️ CRITICAL**: nenhuma história (US1–US4) começa antes desta fase concluída e verde.

### Funções puras D1/D2 (TDD — testes primeiro)

- [x] T004 [P] Unit test de `computeValidUntil` (D1) em
      `src/__tests__/unit/trainings-compute-valid-until.test.ts`: 5 periodicidades (`annual +1`,
      `biennial +2`, `triennial +3`, `quinquennial +5` anos) + `single → null`; date-only
- [x] T005 [P] Unit test de `classifyTrainingStatus` (D2) em
      `src/__tests__/unit/trainings-classify-status.test.ts`: matriz `missing/expired/due_soon/ok`,
      `single`=`ok`, `latest==null`=`missing`, fronteiras hoje / hoje+30 / hoje+90 (inclusivo,
      `America/Sao_Paulo`)
- [x] T006 Implementar `computeValidUntil(completedAt, periodicity)` e
      `classifyTrainingStatus(latest, { today, dueWindowDays })` em `src/shared/domains/pgr/trainings.ts`
      (fazer T004/T005 passarem); date-only, fuso `America/Sao_Paulo`, inclusivo

### Enum, tabelas e schemas Zod

- [x] T007 Definir enum `training_periodicity` (`annual|biennial|triennial|quinquennial|single`) + as 3
      tabelas (`training_catalog`, `training_records`, `job_role_required_trainings`) em
      `src/shared/db/schema/trainings.ts` — molde `companies.ts`/`epis.ts`: `org_id → orgs.id` cascade
      indexado, timestamps, `pgPolicy(...).enableRLS()` por tabela; CHECK `workload_hours > 0`; UNIQUE
      `(org_id,name)` e `(org_id,job_role_id,training_id)`; FKs `employee_id`/`job_role_id` CASCADE,
      `training_id` RESTRICT (ver data-model.md)
- [x] T008 Reexportar as novas tabelas/tipos em `src/shared/db/schema/index.ts`
- [x] T009 [P] Adicionar os schemas Zod em `src/shared/domains/pgr/trainings.ts`:
      `trainingPeriodicitySchema`, `trainingCatalogInputSchema` (nome obrigatório, `workloadHours` inteiro
      `>0`, periodicidade no enum), `trainingRecordInputSchema` (`completedAt` não-futuro,
      `certificatePath` opcional; sem `valid_until` no input), `jobRoleRequiredTrainingInputSchema` + labels
      PT das periodicidades
- [x] T010 [P] Unit test dos schemas Zod em `src/__tests__/unit/trainings-schemas.test.ts`: catálogo
      (carga `≤0`/não-inteira e periodicidade inválida → erro) e registro (`completed_at` futuro → erro;
      certificado opcional aceito)

### Migration

- [x] T011 Gerar a migration (`npm run db:generate`) e editar `src/shared/db/migrations/
0016_training_module.sql` para incluir, como SQL custom (padrão `0007`): GRANT
      `SELECT,INSERT,UPDATE,DELETE` ao `app_runtime`, trigger `set_updated_at` por tabela e
      `CREATE POLICY *_isolation` por tabela; conferir ON DELETE (CASCADE employee/job_role, RESTRICT
      training_id), CHECK e UNIQUEs
- [x] T012 Integração (Postgres efêmero) do modelo em
      `src/__tests__/integration/trainings-model.test.ts`: RLS/isolamento nas 3 tabelas; FKs válidas; CHECK
      `workload_hours>0`; UNIQUEs; CASCADE (employee/job_role) e RESTRICT (catálogo em uso). Rodar
      `npm run test:integration`

**Checkpoint**: modelo aplicado + `computeValidUntil`/`classifyTrainingStatus` testados. Histórias podem
começar.

---

## Phase 3: US1 — CRUD do Catálogo de Treinamentos (Priority: P1) 🎯 MVP

**Goal**: cadastrar/listar/buscar/detalhar/editar/excluir treinamentos do catálogo com os 5 campos ePGR;
item em uso não é excluído sem aviso.

**Independent Test**: executar as 5 operações via UI e REST, incluindo `409` duplicado, `404`
cross-tenant, `dependents` bloqueando exclusão em uso, `FORBIDDEN` para `client`.

### Implementation

- [x] T013 [US1] Repositório `src/shared/db/repositories/training-catalog.ts`:
      `listTrainingCatalog` (paginado `{rows,total}` + busca `ILIKE` em `name`/`reference_norm`),
      `getTrainingCatalogById`, `createTrainingCatalog`, `updateTrainingCatalog`, `deleteTrainingCatalog`,
      `countTrainingCatalogDependents` (`{records, requiredLinks}`) — tudo em `withOrg` + escrita via
      `auditedTenantWrite`; molde `repositories/companies.ts`
- [x] T014 [US1] Server Actions `src/shared/server/actions/pgr/training-catalog.ts`
      (`officeAction` → `ActionResult`): list/get/create/update/delete/dependents; `NotFoundError` p/ 404;
      `revalidatePath` (ver contracts/server-actions.md)
- [x] T015 [P] [US1] REST mirror `src/app/api/v1/training-catalog/route.ts` (GET list, POST create `201`)
      e `src/app/api/v1/training-catalog/[id]/route.ts` (GET/PUT/DELETE `204`) via `restHandler`, reusando
      repo+zod+`toActionError`
- [x] T016 [P] [US1] REST `src/app/api/v1/training-catalog/[id]/dependents/route.ts` (GET
      `{records, requiredLinks}`)
- [x] T017 [P] [US1] UI `src/app/(protected)/training-catalog/**` (lista + form) no molde `_ui/{list,
form}` e páginas de epi-catalog; select de periodicidade com rótulos PT; estado vazio orienta 1º
      cadastro; sem tela "detalhe só-leitura" (form = detalhe)
- [x] T018 [US1] Integração (Postgres efêmero)
      `src/__tests__/integration/training-catalog.test.ts`: 5 operações; `404` cross-tenant em
      get/update/delete; `409` nome duplicado no mesmo org; `dependents` bloqueia exclusão em uso;
      `FORBIDDEN` para `client`
- [x] T019 [P] [US1] Docs: registrar `training-catalog` (recursos/verbos/filtros) em
      `docs/api/api-design.md` e adicionar pasta `training-catalog` em
      `docs/api/sst-manager.postman_collection.json`

**Checkpoint**: catálogo funcional e testável isoladamente (MVP).

---

## Phase 4: US2 — Registro de treinamento realizado (Priority: P1)

**Goal**: registrar realização por funcionário com `valid_until` calculado no servidor (D1);
`single → null`; data futura bloqueada.

**Independent Test**: registrar realização e conferir `valid_until` por periodicidade (`single`→null),
data futura → `VALIDATION`, funcionário/treinamento cross-tenant → erro sem gravar.

### Implementation

- [x] T020 [US2] Repositório `src/shared/db/repositories/training-records.ts`:
      `listTrainingRecordsByEmployee` (paginado), `getTrainingRecordById`, `createTrainingRecord` (recebe
      `valid_until` já calculado), `deleteTrainingRecord` — `withOrg` + `auditedTenantWrite`
- [x] T021 [US2] Server Actions `src/shared/server/actions/pgr/training-records.ts`: no create, buscar a
      periodicidade do treinamento (repo do catálogo) e calcular `valid_until` com `computeValidUntil` (D1)
      **no servidor** antes do insert; list/get/delete; `FK_NOT_FOUND` para funcionário/treinamento de outro
      tenant
- [x] T022 [P] [US2] REST mirror `src/app/api/v1/training-records/route.ts` (GET `?employeeId`, POST
      `201`) e `src/app/api/v1/training-records/[id]/route.ts` (GET/DELETE `204`) via `restHandler`
- [x] T023 [P] [US2] UI de registro + histórico em `src/app/(protected)/employees/[id]/**` (form:
      treinamento do catálogo + `completed_at` + certificado opcional; exibição opcional da validade prevista
      como feedback, valor gravado é do servidor)
- [x] T024 [P] [US2] Unit test em `src/__tests__/unit/training-record-validity.test.ts`: cálculo de
      `valid_until` via D1 no fluxo de create + rejeição de `completed_at` futuro + `single→null`
- [x] T025 [US2] Integração (Postgres efêmero)
      `src/__tests__/integration/training-records.test.ts`: create grava `valid_until` correto; `single`
      grava `null`; `completed_at` futuro → `VALIDATION`; funcionário/treinamento cross-tenant → erro sem
      gravar; `FORBIDDEN` para `client`
- [x] T026 [P] [US2] Docs: registrar `training-records` em `docs/api/api-design.md` + pasta Postman

**Checkpoint**: US1 e US2 funcionais e independentes.

---

## Phase 5: US3 — Controle de vencimento / reciclagem (Priority: P1)

**Goal**: visão só-leitura de vencidos e a vencer por funcionário (helper D5 + D2), filtro por
funcionário e janela; `single` fora do cômputo; resumo `{expired,dueSoon}` para dashboard.

**Independent Test**: com realizações variadas, listar por status; `single` nunca vencido; reciclagem
move o status (só último registro); filtros e resumo corretos, escopados ao tenant.

### Implementation

- [x] T027 [US3] Repositório `src/shared/db/repositories/training-compliance.ts`: helper D5
      (`ROW_NUMBER() OVER (PARTITION BY employee_id, training_id ORDER BY completed_at DESC)`, `rn=1`),
      `listTrainingExpiry({ employeeId?, dueWithinDays })` (exclui `valid_until IS NULL`; junta
      employee/catalog) e `getTrainingDueSummary()` (`{expired,dueSoon}`) — tudo em `withOrg`; classificação
      por `classifyTrainingStatus` (D2). **Nomenclatura da janela**: o parâmetro de filtro/API é
      `dueWithinDays` e é repassado **verbatim** como o argumento `dueWindowDays` de D2 (mesmo valor em dias,
      nomes distintos por camada — não são conceitos diferentes)
- [x] T028 [US3] Leitura via Server Component / action de listagem
      `src/shared/server/actions/pgr/training-records.ts` (ou módulo dedicado): `listTrainingExpiryAction`,
      `getTrainingDueSummaryAction`
- [x] T029 [P] [US3] UI de vencimento em `src/app/(protected)/employees/[id]/**` (ou tela consolidada):
      colunas Funcionário · Treinamento · Data · Validade · Status (Vencido/A vencer/Em dia); filtro de
      janela 30/60/90 (um parâmetro); estado vazio positivo
- [x] T030 [P] [US3] Unit test em `src/__tests__/unit/training-expiry.test.ts` do mapeamento
      linha→status da US3 (função pura que aplica `classifyTrainingStatus` sobre `{ validUntil }` + `today` +
      `dueWithinDays`): confirma que `valid_until IS NULL` (`single`) não produz status de vencimento e que
      a janela recebida (30/60/90) é repassada como `dueWindowDays` a D2. (A precedência do último registro
      em si — D5, window function no SQL — é coberta pela integração T031.)
- [x] T031 [US3] Integração (Postgres efêmero)
      `src/__tests__/integration/training-expiry.test.ts`: lista e resumo corretos por status; `single` fora
      do cômputo; reciclagem move o status; isolamento cross-tenant
- [x] T032 [P] [US3] Docs: registrar a listagem de vencimento (e o resumo, se exposto por API) em
      `docs/api/api-design.md` + Postman quando tiver valor de API

**Checkpoint**: US1–US3 funcionais e independentes.

---

## Phase 6: US4 — Obrigatórios por função + conformidade (Priority: P2)

**Goal**: vincular treinamentos obrigatórios a funções (add idempotente/remove/list) e sinalizar
funcionários não-conformes (`missing`/`expired`), reusando D5+D2.

**Independent Test**: add/remove vínculo; conformidade por funcionário (inclui `missing` e último
registro); funcionário sem função = conforme por vacuidade; isolamento; `FORBIDDEN` para `client`.

### Implementation

- [x] T033 [US4] Repositório `src/shared/db/repositories/job-role-required-trainings.ts`:
      `listRequiredTrainings({ jobRoleId })`, `addRequiredTraining` (idempotente via UNIQUE),
      `removeRequiredTraining` — `withOrg` + `auditedTenantWrite`
- [x] T034 [US4] Estender `src/shared/db/repositories/training-compliance.ts` com
      `getEmployeeCompliance({ employeeId })` e `listNonCompliance()`: para cada obrigatório da função do
      funcionário, último registro (D5) classificado por D2; sem registro → `missing`; funcionário sem função
      → vazio (conforme por vacuidade); não-conforme = `missing`|`expired`
- [x] T035 [US4] Server Actions `src/shared/server/actions/pgr/job-role-required-trainings.ts`:
      list/add/remove + `getEmployeeComplianceAction` + `listNonComplianceAction`; `FK_NOT_FOUND` cross-tenant
- [x] T036 [P] [US4] REST mirror `src/app/api/v1/job-role-required-trainings/route.ts` (GET `?jobRoleId`,
      POST `201` idempotente) e `.../[id]/route.ts` (DELETE `204`) via `restHandler`
- [x] T037 [P] [US4] UI: aba "Treinamentos Obrigatórios" no perfil
      `src/app/(protected)/employees/[id]/**` (status por obrigatório) + tela de gestão função → obrigatórios
  - relatório de não-conformes (mesma query sem filtro)
- [x] T038 [US4] Integração (Postgres efêmero)
      `src/__tests__/integration/job-role-required-trainings.test.ts`: add idempotente/remove; conformidade
      (`missing` + último registro D5); **função sem obrigatórios → lista vazia, não erro** (FR-042);
      funcionário sem função conforme por vacuidade (lista vazia); mesmo treinamento em várias funções;
      isolamento cross-tenant; `FORBIDDEN` para `client`
- [x] T039 [P] [US4] Docs: registrar `job-role-required-trainings` (+ conformidade se exposta por API) em
      `docs/api/api-design.md` + pasta Postman

**Checkpoint**: todas as histórias funcionais e independentes.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T040 [P] Revisar rótulos PT das periodicidades e mensagens de erro nas telas (consistência UI)
- [x] T041 Rodar `npm run check` (format + lint + typecheck + unit) e corrigir pendências
- [x] T042 Rodar `npm run test:integration` completo (Postgres efêmero) e garantir verde
- [x] T043 Validar `quickstart.md` ponta a ponta (ordem Fundação → US1 → US2 → US3 → US4) e conferir o
      checklist de API surface (os 4 juntos por recurso: Server Action + REST + api-design.md + Postman)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Fundação (Phase 2)**: depende do Setup; **BLOQUEIA** todas as histórias (migration + D1/D2 + zod).
- **US1 (Phase 3)**: depende da Fundação. Sem dependência de outras histórias (MVP).
- **US2 (Phase 4)**: depende da Fundação + US1 (usa catálogo e periodicidade para D1).
- **US3 (Phase 5)**: depende da Fundação + US2 (classifica realizações; usa D5+D2).
- **US4 (Phase 6)**: depende da Fundação + US3 (reusa helper D5 e conformidade em
  `training-compliance.ts`).
- **Polish (Phase 7)**: depende das histórias desejadas concluídas.

### Within Each User Story

- Testes de função pura escritos antes da implementação (T004/T005 antes de T006).
- Schema/migration antes dos repositórios; repositório → Server Action → REST/UI.
- Integração por história roda contra Postgres efêmero após a implementação da história.

### Parallel Opportunities

- Setup: T002 e T003 em paralelo.
- Fundação: T004 e T005 em paralelo (arquivos de teste distintos); T009/T010 em paralelo após o schema.
- US1: T015, T016, T017, T019 em paralelo (REST/UI/docs em arquivos distintos) após T013/T014.
- US2: T022, T023, T024, T026 em paralelo após T020/T021.
- US3: T029, T030, T032 em paralelo após T027/T028.
- US4: T036, T037, T039 em paralelo após T033/T034/T035.

---

## Parallel Example: US1

```bash
# Após T013 (repo) e T014 (actions), lançar em paralelo:
Task: "REST mirror training-catalog (route + [id]) em src/app/api/v1/training-catalog/**"
Task: "REST dependents em src/app/api/v1/training-catalog/[id]/dependents/route.ts"
Task: "UI CRUD em src/app/(protected)/training-catalog/**"
Task: "Docs api-design.md + pasta Postman training-catalog"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 (Setup) → Phase 2 (Fundação, bloqueante: migration `0016` + D1/D2 + zod).
2. Phase 3 (US1 — catálogo). **STOP & VALIDATE**: CRUD isolado verde (unit + integração).
3. Demo do catálogo (MVP).

### Incremental Delivery

Fundação → US1 (MVP) → US2 → US3 → US4, cada uma testável isoladamente antes da próxima (ordem P1→P2).
`npm run check` e `npm run test:integration` verdes a cada história.

---

## Notes

- [P] = arquivos diferentes, sem dependência pendente.
- Isolamento multi-tenant e `FORBIDDEN` para `client` são caminho crítico em toda US com escrita.
- Testes de integração SEMPRE contra Postgres efêmero (`INTEGRATION_*`), nunca SQLite nem banco de dev.
- Nenhum código de erro novo; nenhuma migration além da `0016`.
- Commit após cada task ou grupo lógico; branch/commits em inglês, conteúdo de spec em pt-BR.
