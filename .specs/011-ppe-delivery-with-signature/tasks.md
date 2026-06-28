---
description: "Task list — Entrega de EPI com assinatura digital (011)"
---

# Tasks: Entrega de EPI com assinatura digital

**Input**: Design documents from `.specs/011-ppe-delivery-with-signature/`

**Prerequisites**: plan.md ✓, spec.md ✓ (+ Clarifications), research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: INCLUÍDOS — testes são obrigatórios (Constituição §V/Quality Gates e Success Criteria da
spec). Unit para lógica pura/schemas; integração (Server Actions + rota pública + isolamento) contra
**Postgres efêmero** (`INTEGRATION_*`), **nunca SQLite nem o banco de dev**.

**Organization**: tarefas agrupadas por user story (US1 P1 = MVP; US2 P2; US3 P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos distintos, sem dependência pendente)
- **[Story]**: US1 / US2 / US3 (fases de história); Setup/Foundational/Polish sem rótulo

## Path Conventions

Web app unificado no Next.js (ver plan.md). Código em `src/...`; testes em `src/__tests__/...`.
**Zero migration** (modelo 008 já cobre o schema).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: estrutura de arquivos/pastas da fatia (reusa o projeto existente).

- [X] T001 [P] Criar stubs e diretórios: `src/shared/domains/pgr/epi-deliveries.ts`,
  `src/shared/db/repositories/epi-deliveries.ts`, `src/shared/server/actions/pgr/epi-deliveries.ts`, e
  as pastas `src/app/(protected)/employees/[id]/epi-delivery/`, `src/app/epi-deliveries/sign/[token]/`,
  `src/app/api/v1/epi-deliveries/`, `src/app/api/public/epi-deliveries/[token]/`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: infra compartilhada que BLOQUEIA todas as histórias (erros, mapa HTTP, domínio, helper de baixa).

**⚠️ CRITICAL**: nenhuma história pode começar antes desta fase.

- [X] T002 [P] Criar erros `AlreadySignedError` (code `ALREADY_SIGNED`, status 409) e `TokenExpiredError`
  (code `TOKEN_EXPIRED`, status 410) estendendo `AppError` em
  `src/shared/errors/already-signed-error.ts` e `src/shared/errors/token-expired-error.ts`.
- [X] T003 Adicionar `ALREADY_SIGNED: 409` e `TOKEN_EXPIRED: 410` ao `HTTP_BY_CODE` em
  `src/shared/api/rest.ts` (mantendo `INSUFFICIENT_STOCK: 422` da 010).
- [X] T004 Domínio em `src/shared/domains/pgr/epi-deliveries.ts`: `deliveryCreateSchema`
  (`employeeId` uuid; `deliveryDate` `YYYY-MM-DD`; `items` não-vazio de `{stockId uuid, quantity int>0}`;
  **proibir `stockId` duplicado**), `signMethodSchema` (`qr|link`), DTOs, e funções puras:
  `generateAuthToken()` (alta entropia), `isTokenExpired(createdAt, now, 72h)`,
  `nextSignatureStatus(method)`, `signedQuantityForDelivery()` (`employee_delivery` `−`), labels pt-BR.
- [X] T005 Refatorar `src/shared/db/repositories/stock-movements.ts`: extrair helper
  `applyStockExit(tx, { orgId, stockId, quantity, deliveryId?, type })` (`SELECT … FOR UPDATE` → valida
  `>= 0` → `INSERT stock_movements` → `UPDATE balance`), reutilizável para `employee_delivery`,
  **mantendo o comportamento atual da 010 e seus testes verdes**.
- [X] T006 [P] Unit tests do domínio em `src/__tests__/unit/domains/pgr/epi-deliveries.test.ts`:
  `deliveryCreateSchema` (não-vazio, quantity>0, sem duplicado), `isTokenExpired` (limite de 72h),
  `nextSignatureStatus`, `signedQuantityForDelivery`. (Escrever antes; devem falhar.)

**Checkpoint**: fundação pronta — histórias podem começar.

---

## Phase 3: User Story 1 - Registrar entrega com baixa de estoque (Priority: P1) 🎯 MVP

**Goal**: gestor cria a entrega, registra **assinatura manual** e o estoque é baixado atomicamente.

**Independent Test**: criar entrega com 2 itens, assinar manualmente → `signed_manual`, 1
`employee_delivery`/item (com `delivery_id`), saldo reduzido; quantidade > saldo → rollback total.

### Tests for User Story 1 ⚠️ (Postgres efêmero)

- [X] T007 [P] [US1] Integração em `src/__tests__/integration/pgr/epi-deliveries.test.ts`:
  `createDelivery` cria entrega `pending` + itens **sem baixa**; `signDeliveryManual` baixa o saldo +
  cria 1 `employee_delivery`/item (com `delivery_id`) + status `signed_manual`; **saldo insuficiente →
  rollback total** (sem entrega assinada, sem movimento, sem alteração de saldo); só itens com saldo na
  seleção; aviso de mínima; `NOT_FOUND` cross-tenant; `FORBIDDEN` para `client`. (Mockar
  `requireOfficeStaff`; helpers `_helpers/{db,pgr-seed}`.)

### Implementation for User Story 1

- [X] T008 [US1] Repo `createDelivery(orgId, input)` em `src/shared/db/repositories/epi-deliveries.ts`:
  valida funcionário do tenant, valida cada item (existe, mesmo tenant, `balance >= quantity`), proíbe
  duplicado, resolve `catalog_id` de `epi_stock`, gera `auth_token`, `INSERT epi_deliveries(pending)` +
  `epi_delivery_items`; **sem baixa**; `auditedTenantWrite`.
- [X] T009 [US1] Repo `signDeliveryManual(orgId, deliveryId)` (mesmo arquivo, depende de T005+T008):
  carrega entrega do tenant (`NOT_FOUND` cross-tenant; `ALREADY_SIGNED` se `status != pending`); baixa
  transacional via `applyStockExit` por item; `signature_status='signed_manual'`; retorna
  `{ delivery, newBalances, lowStockWarnings }` (`deriveStockStatus`).
- [X] T010 [P] [US1] Repo `getDelivery` / `getDeliveryStatus(orgId, deliveryId)` (leitura) no mesmo arquivo.
- [X] T011 [US1] Actions internas em `src/shared/server/actions/pgr/epi-deliveries.ts`:
  `createDeliveryAction`, `signDeliveryManualAction`, `getDeliveryAction`, `listDeliverableStockAction`
  (reuso `listEpiStock` `withBalanceOnly`) via `officeAction(..., {audit})` + `revalidatePath`.
- [X] T012 [P] [US1] REST interno via `restHandler` em `src/app/api/v1/epi-deliveries/`:
  `POST /` (criar, 201), `POST /[id]/sign-manual` (200), `GET /[id]/status` (200).
- [X] T013 [US1] UI Passo 1 (seleção) em `src/app/(protected)/employees/[id]/epi-delivery/page.tsx`
  (Server Component, `requireOfficeStaffPage`, tabela de `epi_stock` com `balance>0`, busca por CA/nome)
  + client de seleção (checkbox habilita quantidade) usando `_ui/{form,list}`.
- [X] T014 [US1] UI Passo 2 (revisão, modal) + Passo 3 aba **Assinatura Manual** em
  `src/app/(protected)/employees/[id]/epi-delivery/_components/` (client `useState`/`useTransition`,
  espelhando `epi-stock/_components/register-entry.tsx`), chamando as actions; gancho na página do funcionário.
- [X] T015 [US1] Mensagens pt-BR + tratamento de erro na UI (mostra `INSUFFICIENT_STOCK`; exibe aviso de mínima).

**Checkpoint**: US1 funcional e testável isolada — **MVP entregável** (entrega + manual + baixa).

---

## Phase 4: User Story 2 - Funcionário confirma sem login (Priority: P2)

**Goal**: confirmação remota por QR/link em rota **pública** (sem Clerk), com baixa na org correta.

**Independent Test**: criar entrega pendente; confirmar pela página pública (sem sessão) → baixa na org
certa + `signed_qr`/`signed_link`; token de outra org não vaza e só afeta a própria entrega.

### Tests for User Story 2 ⚠️ (Postgres efêmero — o isolamento público é o crítico)

- [ ] T016 [P] [US2] Integração (append em `src/__tests__/integration/pgr/epi-deliveries.test.ts`):
  `confirmDeliveryByToken` baixa na org correta + `signed_qr`/`signed_link`; **token de outra org não
  vaza dados e a confirmação só afeta a entrega do token**; inexistente → 404; já usado → 409
  (`ALREADY_SIGNED`); expirado (>72h) → 410 (`TOKEN_EXPIRED`); idempotência.

### Implementation for User Story 2

- [ ] T017 [US2] Repo público em `src/shared/db/repositories/epi-deliveries.ts`:
  `getDeliveryByToken(token)` (busca por `auth_token` **sem** `current_setting`, retorna dados mínimos)
  e `confirmDeliveryByToken(token, method)` (valida pendente/expiração; deriva `org_id`; baixa via
  `withOrg` + `applyStockExit`; `signed_qr`/`signed_link`; idempotente; auditado).
- [ ] T018 [P] [US2] Route handlers públicos em `src/app/api/public/epi-deliveries/[token]/`:
  `GET` (carregar dados mínimos) e `POST .../confirm` (`{method}`); **sem Clerk**, `no-store`;
  mapeiam 404/409/410/422.
- [ ] T019 [US2] Liberar a rota pública em `src/proxy.ts` (`createRouteMatcher`):
  `"/epi-deliveries/sign/(.*)"` e `"/api/public/epi-deliveries/(.*)"`; **sem** usar o bypass dev de `/api/v1`.
- [ ] T020 [US2] Página pública `src/app/epi-deliveries/sign/[token]/page.tsx` (**fora de `(protected)`**,
  layout sem sidebar): mostra funcionário/itens/quantidades/data + "Confirmar recebimento"; trata
  inexistente/expirado/já assinado.
- [ ] T021 [US2] UI aba **QR Code** (no client de autenticação): renderiza QR da URL pública do token
  (lib mínima — ver research D6) + painel "Aguardando confirmação…" com **polling (~5s)** de
  `getDeliveryStatusAction`.

**Checkpoint**: US1 + US2 funcionam isoladas; caminho público com isolamento provado.

---

## Phase 5: User Story 3 - Assinatura manual quando não há dispositivo (Priority: P3)

**Goal**: contingência — "Enviar Link" só gera/exibe o link; sem contato, orienta cadastro.

**Independent Test**: funcionário sem e-mail/telefone → aba "Enviar Link" indisponível, orienta
completar o cadastro; o caminho manual (US1) permanece disponível.

### Tests for User Story 3 ⚠️

- [ ] T022 [P] [US3] Unit (append em `src/__tests__/unit/domains/pgr/epi-deliveries.test.ts`):
  disponibilidade do método "Enviar Link" em função de `email`/`phone` do funcionário (com/sem contato).

### Implementation for User Story 3

- [ ] T023 [US3] UI aba **Enviar Link** (no client de autenticação): gera/exibe/**copia** o link do
  token (sem disparo de e-mail/SMS — FR-018); se funcionário sem `email`/`phone` → "Ir para cadastro do
  funcionário".
- [ ] T024 [US3] (Opcional — fora do MVP conforme spec) Ficha de controle **print-friendly** da
  assinatura manual (página imprimível simples). Marcar como opcional; não bloqueia a fatia.

**Checkpoint**: todas as histórias independentemente funcionais.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T025 [P] Revisar referências/briefing (`docs/briefings/briefing-ppe-delivery-with-signature.md`) e docstrings.
- [ ] T026 Quality gate: `npm run lint` + `npx tsc --noEmit` + `npm run test` verdes; `npm run
  test:integration` verde **contra Postgres efêmero** (`INTEGRATION_*`) — nunca SQLite/dev.
- [ ] T027 Rodar a validação do `quickstart.md` (Cenários 1–3).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup — **bloqueia todas as histórias**. Dentro dela: T005
  (helper de baixa) é pré-requisito de T009/T017; T002/T003 antes do mapeamento de erros nas REST.
- **US1 (Phase 3)**: depende da Fundação. T008 → T009/T010 → T011 → T012 → T013/T014/T015.
- **US2 (Phase 4)**: depende da Fundação (e reusa o helper T005). T017 → T018 → T019/T020/T021.
- **US3 (Phase 5)**: depende da Fundação; UI reusa o client de autenticação criado em US1/US2.
- **Polish (Phase 6)**: depende das histórias desejadas concluídas.

### User Story Dependencies

- **US1 (P1)**: independente — entrega o MVP (inclui assinatura manual + baixa).
- **US2 (P2)**: independente de US1 no teste, mas compartilha o helper de baixa e a entrega criada.
- **US3 (P3)**: independente; complementa a UI de autenticação.

### Parallel Opportunities

- T001 e T002/T006 marcados [P] (arquivos distintos).
- Dentro de US1: T010 e T012 [P]; UI (T013/T014) após actions/REST.
- US2: T018 [P] (handlers) paralelo a outros arquivos; T016 (teste) [P].
- Após a Fundação, US1/US2/US3 podem ser tocadas por pessoas diferentes (arquivos majoritariamente distintos; cuidado com edições concorrentes no mesmo `epi-deliveries.ts` de repo).

---

## Parallel Example: Foundational + US1 tests

```bash
# Fundação (arquivos distintos):
Task: "T002 erros AlreadySigned/TokenExpired em src/shared/errors/"
Task: "T006 unit tests do domínio em src/__tests__/unit/domains/pgr/epi-deliveries.test.ts"

# Testes de integração por história (arquivos/append distintos):
Task: "T007 [US1] integração actions internas (manual + rollback)"
Task: "T016 [US2] integração rota pública + isolamento"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Setup (Phase 1) → Foundational (Phase 2).
2. US1 (Phase 3): entrega + assinatura manual + baixa transacional.
3. **STOP e VALIDAR**: testar US1 isolada (rollback, isolamento, autorização).
4. Demonstrável: já comprova legalmente a entrega sem a parte pública.

### Incremental Delivery

1. Fundação pronta → US1 (MVP) → validar/demo.
2. US2 (QR + rota pública) → validar isolamento público → demo.
3. US3 (Enviar Link / contingência) → demo.

---

## Notes

- **Postgres efêmero obrigatório** para integração (RLS/CHECK/transação/caminho público). Seguindo o
  padrão da 010, as suítes de integração podem ser **escritas** e só **executadas** onde houver
  `INTEGRATION_*` configurado — **nunca** apontar para o banco de dev (suítes fazem `TRUNCATE`).
- [P] = arquivos distintos, sem dependência pendente. Evitar editar o mesmo `epi-deliveries.ts` em paralelo.
- Verificar que os testes falham antes de implementar; commit por tarefa ou grupo lógico.
- **Zero migration**: não alterar o schema 008. Expiração do token é derivada (`created_at` + 72h).
- Rótulo [Story] mapeia a tarefa à história para rastreabilidade.
