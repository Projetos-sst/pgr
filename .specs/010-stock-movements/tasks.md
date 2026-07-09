---
description: "Task list — Movimentações de estoque e histórico (stock_movements)"
---

# Tasks: Movimentações de estoque e histórico (`stock_movements`)

**Input**: Design documents from `.specs/010-stock-movements/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅
(server-actions, repositories, rest-endpoints)

**Tests**: INCLUÍDOS — a constituição e o `CLAUDE.md` tornam testes obrigatórios (quality gate); a
spec define a "Definição de pronto" com unit + integração em Postgres efêmero.

**Organization**: tarefas agrupadas por user story (US1–US4) para implementação/teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 (entrada) · US2 (saída + saldo não-negativo) · US3 (histórico) · US4 (isolamento)
- Caminhos de arquivo exatos em cada descrição

## ⚠️ Pré-condição de execução (GATE — antes de QUALQUER tarefa de implementação)

> A base 008 (`epis.ts`) e 009 (`epi-stock`) **não estão** em `develop` nem em
> `feature/stock-movements`; vivem em `feature/epi-stock-crud`. **Implementação bloqueada** até
> resolver (ver `plan.md` §"Pré-condições de branch"). As tarefas T001–T002 cobrem isso.

---

## Phase 1: Setup

- [x] T001 Resolver a pré-condição de branch: rebasear `feature/stock-movements` sobre
      `feature/epi-stock-crud` (008+009) **ou** sobre `develop` após o merge da 009; confirmar que
      existem `src/shared/db/schema/epis.ts`, `src/shared/db/repositories/epi-stock.ts` e
      `src/app/(protected)/epi-stock/`.
- [x] T002 Verificar o ambiente de testes de integração: `INTEGRATION_DATABASE_URL` e
      `INTEGRATION_APP_RUNTIME_URL` apontando para **Postgres efêmero** (nunca o banco de dev); rodar
      `npm run lint` e `npm run test` na base já existente para garantir verde antes de começar.

---

## Phase 2: Foundational (bloqueia todas as user stories)

**Objetivo**: infraestrutura compartilhada (código de erro, domínio com zod/DTO/funções puras,
esqueleto do repositório) sobre a qual US1–US4 são construídas.

- [x] T003 [P] Criar a classe de erro `InsufficientStockError` em
      `src/shared/errors/insufficient-stock-error.ts`, estendendo `AppError` com
      `readonly code = "INSUFFICIENT_STOCK"` e `readonly status = 422`, **idêntico ao padrão de**
      `src/shared/errors/not-found-error.ts` (uma classe por arquivo, `import "server-only"`).
- [x] T004 Adicionar `INSUFFICIENT_STOCK: 422` ao `HTTP_BY_CODE` em `src/shared/api/rest.ts`.
      **NÃO** editar `src/shared/server/action-error.ts`: o `toActionError` já mapeia qualquer `AppError`
      via `{ code: error.code, message: error.message }`, então `InsufficientStockError` vira o código do
      contrato automaticamente.
- [x] T005 [P] Criar o módulo de domínio `src/shared/domains/pgr/stock-movements.ts` com os schemas
      zod `stockEntrySchema` ({stockId uuid, quantity int>0, movementDate date, invoiceNumber? trim}) e
      `stockExitSchema` ({stockId uuid, quantity int>0, movementDate date, type ∈ {adjustment,discard}}).
- [x] T006 [P] No mesmo módulo de domínio, adicionar `signedQuantity(type, quantity)`,
      `stockMovementTypeLabel(type)` (rótulos pt-BR) e os tipos DTO `StockMovementRow` /
      `{ movement, newBalance }`.
- [x] T007 [P] No mesmo módulo de domínio, implementar a função pura
      `computeRunningBalance(movements)` (saldo acumulado por linha; espelho da window function de D3).
- [x] T008 Criar o esqueleto do repositório `src/shared/db/repositories/stock-movements.ts` com as
      assinaturas `registerStockEntry`/`registerStockExit`/`listStockMovements` usando `withOrg(orgId, …)`
      e imports do schema 008 (`stockMovements`, `epiStock`), sem corpo de regra ainda.

**Checkpoint**: domínio, erro e esqueleto prontos — US1 pode começar.

---

## Phase 3: User Story 1 — Registrar entrada (compra) (Priority: P1) 🎯 MVP

**Goal**: registrar entrada e incrementar o saldo numa transação atômica.

**Independent Test**: registrar entrada de N num item com saldo B → saldo vira B+N, movimento
`purchase` criado; saldo refletido na listagem da 009.

### Tests (US1)

- [x] T009 [P] [US1] Unit do `stockEntrySchema` (quantity>0, NF opcional/trim, campos obrigatórios)
      em `src/__tests__/unit/domains/pgr/stock-movements.test.ts`.
- [x] T010 [P] [US1] Integração (Postgres efêmero) da entrada em
      `src/__tests__/integration/pgr/stock-movements.test.ts`: entrada incrementa `balance` e cria
      movimento `purchase`; quantidade ≤ 0 → `VALIDATION`; `stockId` inexistente → `NOT_FOUND`.

### Implementation (US1)

- [x] T011 [US1] Implementar `registerStockEntry(orgId, {stockId, quantity, movementDate,
invoiceNumber?})` em `src/shared/db/repositories/stock-movements.ts`: transação com
      `SELECT … FOR UPDATE` no `epiStock`, `INSERT` `purchase`, `UPDATE balance += quantity`, retorno
      `{movement, newBalance}`; `NotFoundError` se item ausente/cross-tenant.
- [x] T012 [US1] Criar `registerStockEntryAction` em
      `src/shared/server/actions/pgr/stock-movements.ts` via `officeAction` (zod `stockEntrySchema` →
      `requireOfficeStaff()` → repo; auditoria de escrita sem PII).
- [x] T013 [US1] Criar o Route Handler POST (ramo `kind:"entry"`) em
      `src/app/api/v1/epi-stock/[id]/movements/route.ts` via `restHandler` (201 / 422 / 404 / 403).
- [x] T014 [US1] Criar o Client Component modal de entrada
      `src/app/(protected)/epi-stock/_components/register-entry.tsx` (Data, Quantidade, Nº NF opcional →
      `registerStockEntryAction`) e plugá-lo na tela de estoque da 009, refletindo o novo saldo/status.

**Checkpoint**: US1 funcional e demonstrável (MVP).

---

## Phase 4: User Story 2 — Saída manual com saldo nunca negativo (Priority: P1)

**Goal**: registrar saída (ajuste/descarte) decrementando o saldo, recusando saída > saldo sem gravar.

**Independent Test**: saída S≤B → saldo B−S; saída S′>B → `INSUFFICIENT_STOCK` e nada muda (rollback).

### Tests (US2)

- [x] T015 [P] [US2] Unit do `stockExitSchema` (type restrito a {adjustment,discard}; quantity>0) e
      de `signedQuantity` (purchase +, adjustment/discard −) em
      `src/__tests__/unit/domains/pgr/stock-movements.test.ts`.
- [x] T016 [P] [US2] Integração (Postgres efêmero) da saída em
      `src/__tests__/integration/pgr/stock-movements.test.ts`: saída decrementa e cria
      `adjustment`/`discard`; **saída > saldo → `INSUFFICIENT_STOCK` e NADA gravado** (saldo e contagem
      de movimentos inalterados); type fora de {adjustment,discard} → `VALIDATION`.

### Implementation (US2)

- [x] T017 [US2] Implementar `registerStockExit(orgId, {stockId, quantity, movementDate, type})` em
      `src/shared/db/repositories/stock-movements.ts`: transação com `SELECT … FOR UPDATE`, validação
      `novoSaldo >= 0` (senão `InsufficientStockError` + rollback), `INSERT` + `UPDATE balance -= quantity`.
- [x] T018 [US2] Criar `registerStockExitAction` em `src/shared/server/actions/pgr/stock-movements.ts`
      via `officeAction` (zod `stockExitSchema`; mapeia `InsufficientStockError` → `INSUFFICIENT_STOCK`).
- [x] T019 [US2] Estender o Route Handler POST (ramo `kind:"exit"`) em
      `src/app/api/v1/epi-stock/[id]/movements/route.ts` (422 com `INSUFFICIENT_STOCK` quando aplicável).
- [x] T020 [US2] Criar o Client Component modal de saída
      `src/app/(protected)/epi-stock/_components/register-exit.tsx` (Data, Quantidade, Tipo:
      Ajuste/Descarte → `registerStockExitAction`); exibir mensagem "Saldo insuficiente…" ao falhar.

**Checkpoint**: US1 + US2 — entrada e saída seguras com saldo consistente.

---

## Phase 5: User Story 3 — Histórico com saldo resultante (Priority: P2)

**Goal**: listar movimentos do item, ordenados, com saldo resultante derivado + funcionário (entrega).

**Independent Test**: abrir `/epi-stock/[id]/history` → tabela ordenada com saldo resultante batendo
o saldo atual; item sem movimentos → estado vazio.

### Tests (US3)

- [x] T021 [P] [US3] Unit de `computeRunningBalance` (mix de tipos; acumulado por linha) em
      `src/__tests__/unit/domains/pgr/stock-movements.test.ts`.
- [x] T022 [P] [US3] Integração (Postgres efêmero) do histórico em
      `src/__tests__/integration/pgr/stock-movements.test.ts`: ordem `movement_date DESC, created_at DESC`;
      saldo resultante correto; paginação; estado vazio.

### Implementation (US3)

- [x] T023 [US3] Implementar `listStockMovements(orgId, stockId, {page, pageSize})` em
      `src/shared/db/repositories/stock-movements.ts`: valida item no tenant (senão `NOT_FOUND`); window
      function para saldo resultante; `LEFT JOIN` `epi_deliveries`/`employees` por `delivery_id`;
      `Paginated<StockMovementRow>` (offset, pageSize 20).
- [x] T024 [US3] Criar `listStockMovementsAction(stockId, {page?, pageSize?})` em
      `src/shared/server/actions/pgr/stock-movements.ts` (leitura: `requireOfficeStaff()`, sem auditoria).
- [x] T025 [US3] Implementar o Route Handler GET em
      `src/app/api/v1/epi-stock/[id]/movements/route.ts` (200 com `{rows,total}`; 404; 403).
- [x] T026 [US3] Criar a tela de histórico Server Component
      `src/app/(protected)/epi-stock/[id]/history/page.tsx`: tabela Data · Tipo (pt-BR) · Quantidade ·
      Saldo Resultante · Nº NF · Funcionário (quando entrega); **sem** coluna "Usuário"; estado vazio;
      paginação. Reusar `status-badge` da 009.

**Checkpoint**: US1 + US2 + US3 — fluxo completo + auditoria visual.

---

## Phase 6: User Story 4 — Isolamento entre escritórios (Priority: P1, transversal)

**Goal**: garantir que nada cruza escritórios em nenhum caminho (action/REST/repo).

**Independent Test**: com itens em A e B e A ativo — registrar/consultar item de B por id → 404;
histórico só de A; sem tenant → bloqueado; papel `client` → `FORBIDDEN`.

### Tests (US4)

- [x] T027 [P] [US4] Integração (Postgres efêmero) de isolamento/autorização em
      `src/__tests__/integration/pgr/stock-movements.test.ts`: registrar/consultar item de outro tenant
      → `NOT_FOUND` (404); histórico cross-tenant → vazio; papel `client` → `FORBIDDEN`; sem escritório
      ativo → bloqueado pelo gate (não vira histórico vazio).
- [x] T028 [P] [US4] Estender/garantir o seed `src/__tests__/integration/_helpers/pgr-seed.ts` com
      itens de `epi_stock` em `org_a` e `org_b` para os cenários cross-tenant.

**Checkpoint**: isolamento provado em todos os caminhos.

---

## Phase 7: Polish & Cross-Cutting

- [x] T029 [P] Garantir mensagens de erro pt-BR consistentes ("Saldo insuficiente: disponível X,
      solicitado Y") e rótulos de tipo na UI/DTO.
- [~] T030 Rodar o quality gate: `npm run lint` ✅, `tsc --noEmit` ✅ e `npm run test` (unit) ✅
  (215/215). **`npm run test:integration` NÃO executado**: requer Postgres efêmero (`INTEGRATION_*`)
  e as suítes fazem `TRUNCATE` — proibido apontar para o banco de dev. Rodar quando houver PG
  descartável configurado.
- [ ] T031 [P] Atualizar o briefing/registro (`docs/briefings/briefing-stock-movements.md`) com o
      resultado da implementação (arquivos criados, verificação) se desejado.

---

> **Nota de execução (`/speckit-implement`)**: T001 resolvido por rebase de `feature/stock-movements`
> `--onto feature/epi-stock-crud` (008+009). T028 já coberto pelo seed existente (`epiStockA`@`org_a`,
> `epiStockB`@`org_b`). Testes de integração (T010/T016/T022/T027) **escritos** mas **não executados**
> nesta máquina (sem Postgres efêmero) — `describe.skip` automático sem `INTEGRATION_*`.

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T008)** → bloqueiam tudo.
- **US1 (T009–T014)**: depende de Foundational. É o **MVP**.
- **US2 (T015–T020)**: depende de Foundational; compartilha repo/action/route/domínio com US1
  (T017/T018/T019 tocam os mesmos arquivos de T011/T012/T013 → **sequenciais**, não [P] entre si).
- **US3 (T021–T026)**: depende de Foundational; pode começar em paralelo a US2 após Foundational,
  mas T023/T024/T025 tocam os mesmos arquivos de repo/action/route → coordenar.
- **US4 (T027–T028)**: depende de US1–US3 existirem (testa o comportamento integrado).
- **Polish (T029–T031)**: por último.

## Parallel Opportunities

- **Foundational**: T003, T005, T006, T007 são [P] (arquivos distintos); T004 depende de T003; T008
  depende de T005–T007.
- **Tests primeiro**: dentro de cada story, as tarefas de teste [P] (T009/T010, T015/T016, T021/T022,
  T027/T028) podem ser escritas antes da implementação (TDD) e rodam em paralelo entre si.
- **UI vs REST**: os componentes de UI ([P]) e os Route Handlers podem ser feitos em paralelo aos
  testes, desde que repo/action correspondentes existam.

## Implementation Strategy

- **MVP**: concluir **US1** (entrada) ponta a ponta — já entrega valor (saldo cresce) e prova a
  transação atômica.
- **Incremento crítico**: **US2** (saída + saldo não-negativo) — o maior risco técnico; priorizar o
  teste de rollback (T016).
- **Visibilidade**: **US3** (histórico) fecha o fluxo.
- **Garantia transversal**: **US4** valida isolamento/autorização em todos os caminhos antes do
  fechamento.
