---
description: "Task list — Conclusão da Fase 02 (módulo operacional de EPI)"
---

# Tasks: Conclusão da Fase 02 — Módulo Operacional de EPI

**Input**: Design documents em `.specs/012-epi-module-completion/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: OBRIGATÓRIOS (constituição §"Fluxo de Desenvolvimento" + política do CLAUDE.md) — unit para
regra de negócio, **integração contra Postgres efêmero** (`INTEGRATION_*`, nunca SQLite) para Server
Actions / Route Handlers; isolamento multi-tenant é caminho crítico em toda US com escrita.

**Organization**: por user story (US1–US5), cada uma independentemente testável.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivo diferente, sem dependência pendente)
- **[Story]**: US1–US5 (fases de história); Setup/Foundational/Polish sem label

## Convenções de caminho

Camadas reais do repo: `src/app/**` (pages + `api/v1/**` + `(public)/**`) → `src/shared/server/actions/pgr/*`
→ `src/shared/domains/pgr/*` → `src/shared/db/repositories/*` → `src/shared/db/schema/*`. Testes em
`src/__tests__/unit/**` e `src/__tests__/integration/**`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: preparar segredo e ambiente da fatia.

- [ ] T001 Adicionar `EPI_SIGN_TOKEN_SECRET` ao `.env.example` e à documentação de env do `README`/`CLAUDE.md` (segredo do token de assinatura — Princípio V; nunca commitar valor real)
- [ ] T002 Garantir que o ambiente de integração (`INTEGRATION_DATABASE_URL`) sobe com as migrations `0001–0009` aplicadas via `src/__tests__/integration/_helpers/db.ts` (nenhuma mudança de código; validação de baseline antes da `0010`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: infra compartilhada por US2/US3/US4 — códigos de erro do contrato e a extração dos helpers
de saldo (D2). **⚠️ Nenhuma US com escrita começa antes desta fase.**

- [ ] T003 [P] Criar `src/shared/errors/already-signed-error.ts` (`AlreadySignedError` estende `AppError`, `code = "ALREADY_SIGNED"`) — espelho de `insufficient-stock-error.ts`
- [ ] T004 [P] Criar `src/shared/errors/already-returned-error.ts` (`AlreadyReturnedError`, `code = "ALREADY_RETURNED"`)
- [ ] T005 [P] Criar `src/shared/errors/token-error.ts` (`TokenInvalidError` `code = "TOKEN_INVALID"`; `TokenExpiredError` `code = "TOKEN_EXPIRED"`)
- [ ] T006 Estender `HTTP_BY_CODE` em `src/shared/api/rest.ts`: `ALREADY_SIGNED → 409`, `ALREADY_RETURNED → 409`, `TOKEN_INVALID → 404`, `TOKEN_EXPIRED → 410` (não mexer em `toActionError`, que já converte qualquer `AppError`)
- [ ] T007 Refatorar `src/shared/db/repositories/stock-movements.ts` (D2/R3): extrair `applyStockExit(tx, {orgId, stockId, quantity, deliveryId?, type})` e `applyStockEntry(tx, {orgId, stockId, quantity, deliveryId?, type})` recebendo o `tx` da transação-mãe (`SELECT … FOR UPDATE` → valida/aplica saldo → INSERT movimento com `deliveryId` → UPDATE saldo → retorna novo saldo); `registerStockExit`/`registerStockEntry` passam a chamar os helpers **sem** mudar sua assinatura pública
- [ ] T008 [P] Teste unit `src/__tests__/unit/stock-movements-helpers.test.ts`: `applyStockExit` valida `balance - qty >= 0` (`InsufficientStockError`), `applyStockEntry` soma; ambos aceitam `deliveryId` — cobrir que o comportamento de `registerStockExit/Entry` (#72) permanece idêntico
- [ ] T009 Rodar `npm run test -- --selectProjects unit -t "stock"` e a suíte de integração existente de `stock-movements` para confirmar que a extração **não** regrediu a #72

**Checkpoint**: contrato de erro pronto + helpers de saldo reutilizáveis. US2/US4 podem começar.

---

## Phase 3: User Story 1 — Autofill de CA no catálogo (Priority: P1) 🎯 MVP-A

**Goal**: ao informar um CA no cadastro de EPI, autopreencher fabricante/norma/validade com indicação de
vigência, sem nunca bloquear o salvar (#18/#115/#75).

**Independent Test**: `/epi-catalog/new` → CA vigente autopreenche + badge verde; CA inexistente avisa e
ainda salva.

**Nota**: US1 é ortogonal — não depende da Phase 2. Pode ser feita em paralelo.

- [ ] T010 [US1] Converter em estado controlado (`useState`) os campos `ca`, `caValidUntil`, `manufacturer`, `norm` no `src/app/(protected)/epi-catalog/_components/epi-catalog-form.tsx` (hoje `TextField` com `defaultValue`); `handleSubmit` passa a ler esses do estado
- [ ] T011 [US1] Trocar o `TextField` de CA pelo `CaField` (`src/shared/integrations/caepi/client/ca-field.tsx`) no mesmo form, ligando `value`/`onChange` ao estado e `onFound` para escrever `manufacturer`/`norm`/`caValidUntil` (cópia por valor); campos seguem editáveis
- [ ] T012 [P] [US1] Teste unit `src/__tests__/unit/epi-catalog-form-caepi.test.tsx`: `onFound` autofila em `valid` e `expired`, **não** em `not_found`; submeter com CA vazio/inválido **não** bloqueia (mocka `useCaepiValidation`)
- [ ] T013 [US1] Verificar reuso: a integração da CAEPI (lookup 3 estados + base vazia + guarda de sessão) já é coberta pela fatia 011 — **não** reimplementar; registrar no PR que a cobertura é reusada

**Checkpoint**: US1 funcional e demonstrável isoladamente (zero migration, modelo intacto).

---

## Phase 4: User Story 2 — Entrega + baixa + assinatura manual (Priority: P1) 🎯 MVP-B

**Goal**: registrar entrega de N EPIs com baixa atômica de estoque e assinatura manual (#19 core).

**Independent Test**: selecionar itens com saldo → confirmar entrega → saldo cai; entrega `pending`;
"Registrar assinatura manual" muda status; saldo insuficiente → nada gravado.

**Depends on**: Phase 2 (erros + `applyStockExit`).

### Domínio & repositório

- [ ] T014 [P] [US2] Criar `src/shared/domains/pgr/epi-deliveries.ts`: `createDeliverySchema` (`employeeId` uuid, `deliveryDate` date, `items` array min 1 de `{stockId uuid, quantity int>0}`), `signManualSchema`, tipos `CreateDeliveryInput`/`DeliveryRow`/`DeliveryDetail` + regra pura de transição de assinatura (só de `pending`)
- [ ] T015 [US2] Criar `src/shared/db/repositories/epi-deliveries.ts` com `createDelivery(orgId, input)` (R8): `withOrg` + transação — insere `epi_deliveries` (`pending`); por item faz `SELECT … FOR UPDATE` do `epi_stock` (deriva `catalogId`), insere `epi_delivery_items`, chama `applyStockExit(tx, {type:'employee_delivery', deliveryId})`; falha em qualquer item → rollback total; envolver em `auditedTenantWrite`
- [ ] T016 [US2] No mesmo repositório: `getDelivery(orgId, id)` (itens + status; `NotFoundError` cross-tenant), `listDeliveries(orgId, params)` (paginado `{rows,total}`, filtro `employeeId`), `deleteDelivery(orgId, id)` (**guard**: `signature_status != 'pending'` → `ForbiddenError`), `signDeliveryManual(orgId, id)` (transição `pending → signed_manual` + timestamp; senão `AlreadySignedError`)

### Server Actions & REST

- [ ] T017 [US2] Criar `src/shared/server/actions/pgr/epi-deliveries.ts`: `createDeliveryAction`, `listDeliveriesAction`, `getDeliveryAction`, `deleteDeliveryAction`, `signDeliveryManualAction` — via `officeAction` (`audit:true` nas mutações), retornando `ActionResult<T>`
- [ ] T018 [P] [US2] Criar `src/app/api/v1/epi-deliveries/route.ts`: `GET` (list) + `POST` (create, `201`) via `restHandler`, reusando repo/zod/`toActionError`
- [ ] T019 [P] [US2] Criar `src/app/api/v1/epi-deliveries/[id]/route.ts`: `GET` + `PUT` (metadados enquanto `pending`) + `DELETE` (`204`; `FORBIDDEN` se assinada)
- [ ] T020 [P] [US2] Criar `src/app/api/v1/epi-deliveries/[id]/sign/route.ts`: `POST` (assinatura manual) via `restHandler`

### UI

- [ ] T021 [P] [US2] Criar `src/app/(protected)/employees/[id]/_components/deliver-epi.tsx`: seleção de itens **com saldo disponível** (checkbox · CA · EPI · Tam. · Und. · Disponível · Quantidade; busca por CA/nome) → modal "Preparar entrega" (data) → confirmar (chama `createDeliveryAction`)
- [ ] T022 [P] [US2] Criar `src/app/(protected)/employees/[id]/_components/delivery-signature.tsx` (parte manual): botão "Registrar assinatura manual" (chama `signDeliveryManualAction`) + exibição do status
- [ ] T023 [US2] Integrar na `src/app/(protected)/employees/[id]/page.tsx` a seção "Entregas de EPI" (lista + ação de entregar + status de assinatura)

### Docs & testes

- [ ] T024 [P] [US2] Registrar o recurso `epi-deliveries` em `docs/api/api-design.md` (tabelas "Recursos" e "Sumário": verbos, filtros, códigos) e adicionar a pasta `epi-deliveries` em `docs/api/sst-manager.postman_collection.json` (GET/POST + [id] GET/PUT/DELETE + [id]/sign, reusando Variables)
- [ ] T025 [P] [US2] Teste unit `src/__tests__/unit/epi-deliveries-domain.test.ts`: `createDeliverySchema` (itens min 1, quantidade>0), transição de assinatura + `ALREADY_SIGNED`
- [ ] T026 [US2] Teste integração `src/__tests__/integration/epi-deliveries.test.ts` (Postgres efêmero): baixa atômica multi-item reduz saldo; item sem saldo → `INSUFFICIENT_STOCK` + **saldo intacto** (rollback total); `DELETE` de entrega assinada → `FORBIDDEN`; alvo cross-tenant → `NOT_FOUND`; `FORBIDDEN` para papel `client`; GRANT/RLS por papel

**Checkpoint**: US1 + US2 funcionam de forma independente. **MVP entregável.**

---

## Phase 5: User Story 3 — Assinatura pública QR/link (Priority: P1)

**Goal**: funcionário assina o recebimento por QR/link na rota pública `/sign/[token]`, sem login; painel
do gestor reflete por polling (#19 assinatura).

**Independent Test**: gerar QR/link de uma entrega `pending` → abrir `/sign/<token>` sem sessão →
assinar → status vira `signed_qr/link` e o painel atualiza.

**Depends on**: Phase 2 (erros de token) + US2 (a entrega precisa existir).

- [ ] T027 [P] [US3] Criar `src/shared/integrations/epi-signature/token.ts`: `signToken({orgId, deliveryId})` e `verifyToken(token)` HMAC-SHA256 stateless (payload `{orgId, deliveryId, iat}`, `base64url`, segredo `EPI_SIGN_TOKEN_SECRET`); `verifyToken` retorna payload ou lança `TokenInvalidError`/`TokenExpiredError` (TTL 72h) — R2
- [ ] T028 [P] [US3] Teste unit `src/__tests__/unit/epi-signature-token.test.ts`: round-trip sign/verify; assinatura adulterada → `TOKEN_INVALID`; `iat` além de 72h → `TOKEN_EXPIRED`
- [ ] T029 [US3] Estender `src/shared/db/repositories/epi-deliveries.ts`: `generateSignToken(orgId, id, method)` (gera token, grava `auth_token`, só se `pending`) e `signByToken(token, method)` — verifica token → `withOrg(orgId)` carrega entrega `WHERE id=deliveryId AND auth_token=token` → transição `pending → signed_qr|signed_link` + timestamp (idempotente; já assinada → mensagem, sem 500) — R1
- [ ] T030 [US3] Adicionar em `src/shared/server/actions/pgr/epi-deliveries.ts`: `generateSignTokenAction(id, method)` (via `officeAction`, retorna `{token, url, qrSvg}`) e `submitSignatureAction(token, method)` (**sem** `requireOfficeStaff` — credencial é o token; valida e chama `signByToken`)
- [ ] T031 [US3] Adicionar `"/sign/(.*)"` ao `isPublicRoute` em `src/proxy.ts` (padrão `sign-in`/`webhooks`) e incluir `/sign` em `NO_STORE_PATH_PREFIXES`
- [ ] T032 [US3] Criar `src/app/(public)/sign/[token]/page.tsx`: `GET` verifica token e renderiza itens + `<canvas>` de assinatura (token inválido/expirado/entrega assinada → páginas de negócio, sem 500); `POST`/action chama `submitSignatureAction`; rate-limit por IP no handler
- [ ] T033 [P] [US3] Criar gerador de QR como SVG (função pura em `src/shared/integrations/epi-signature/qr.ts`, sem lib com binário) usado pelo `generateSignTokenAction` — R4
- [ ] T034 [US3] Estender `delivery-signature.tsx` (US2): botões "Gerar QR" / "Gerar link", exibição do QR/URL e painel "Aguardando confirmação" com **polling** do `signature_status`
- [ ] T035 [P] [US3] Documentar a rota pública `/sign/[token]` em `docs/api/api-design.md` (seção de rotas públicas/integrações) e adicionar pasta `sign` no Postman (GET/POST com variável `{token}`)
- [ ] T036 [US3] Teste integração `src/__tests__/integration/epi-sign-public.test.ts` (Postgres efêmero): assinatura pública muda `signature_status` **sem** tenant no contexto e **sem** vazar entre orgs; token de outra org não acessa entrega alheia; token expirado → `TOKEN_EXPIRED`; entrega já assinada → sem 500

**Checkpoint**: US1 + US2 + US3 independentes. Ciclo de assinatura completo (manual + pública).

---

## Phase 6: User Story 4 — Devolução + reposição de saldo (Priority: P2)

**Goal**: devolver um EPI entregue repõe o saldo e marca `returned_at`; barra devolução dupla (#20).
**Única história com migration (`0010`).**

**Independent Test**: devolver um item → saldo sobe pela quantidade; 2ª devolução → barrada.

**Depends on**: Phase 2 (`applyStockEntry`) + US2 (entregas existentes).

- [ ] T037 [US4] Editar `src/shared/db/schema/epis.ts`: adicionar `"employee_return"` ao pgEnum `stockMovementType` e `returnedAt: timestamp("returned_at", {withTimezone:true})` (nullable) em `epiDeliveryItems`
- [ ] T038 [US4] Gerar a migration com `npm run db:generate` e editar para `src/shared/db/migrations/0010_epi_delivery_return.sql` (SQL custom padrão 0005): `ALTER TYPE "stock_movement_type" ADD VALUE IF NOT EXISTS 'employee_return';` `--> statement-breakpoint` `ALTER TABLE "epi_delivery_items" ADD COLUMN "returned_at" timestamptz;` — cabeçalho documenta enum forward-only (R5); aplicar com `npm run db:migrate`
- [ ] T039 [US4] Estender `src/shared/domains/pgr/epi-deliveries.ts`: `returnSchema` (`{ itemId: uuid }`) + regra de guard (`returned_at IS NULL`)
- [ ] T040 [US4] Estender `src/shared/db/repositories/epi-deliveries.ts`: `returnDeliveryItem(orgId, deliveryId, itemId)` — `withOrg` + transação: valida item no tenant e `returned_at IS NULL` (senão `AlreadyReturnedError`) → seta `returned_at = now()` → `applyStockEntry(tx, {type:'employee_return', deliveryId, +quantity})`; independe do status de assinatura; rollback total em falha
- [ ] T041 [US4] Adicionar `returnDeliveryItemAction(deliveryId, itemId)` em `src/shared/server/actions/pgr/epi-deliveries.ts` (via `officeAction`, `audit:true`)
- [ ] T042 [P] [US4] Criar `src/app/api/v1/epi-deliveries/[id]/return/route.ts`: `POST` (body `{itemId}`) via `restHandler`
- [ ] T043 [P] [US4] Adicionar ação "Devolver" por item na UI da entrega (`delivery-signature.tsx` ou seção de itens em `employees/[id]/page.tsx`), chamando `returnDeliveryItemAction` e refletindo `returned_at`
- [ ] T044 [P] [US4] Registrar `POST /epi-deliveries/[id]/return` em `docs/api/api-design.md` + request no Postman (pasta `epi-deliveries`)
- [ ] T045 [P] [US4] Teste unit `src/__tests__/unit/epi-return-guard.test.ts`: guard `returned_at` (não devolve 2×); `applyStockEntry` repõe exatamente `+quantity`
- [ ] T046 [US4] Teste integração `src/__tests__/integration/epi-return.test.ts` (Postgres efêmero): devolução repõe saldo exato (`FOR UPDATE`); 2ª devolução → `ALREADY_RETURNED` + saldo intacto; item cross-tenant → `NOT_FOUND`; devolução independe de assinatura; `FORBIDDEN` para `client`

**Checkpoint**: ciclo de vida do EPI fechado (entrega ↔ devolução).

---

## Phase 7: User Story 5 — Ficha/histórico por funcionário (Priority: P2)

**Goal**: ficha somente-leitura das entregas/devoluções de um funcionário, com filtros e impressão (#21).

**Independent Test**: abrir a ficha de um funcionário → lista com colunas → filtrar status/período →
imprimir.

**Depends on**: US2 (entregas) + coluna `returned_at` da `0010` (US4) para a coluna "Data de Devolução".

- [ ] T047 [P] [US5] Criar `src/shared/domains/pgr/epi-record.ts`: `epiRecordQuerySchema` (`status? pendente|devolvido|todos`, `from?`, `to?`, `page?`, `pageSize?`), mapeamento status→filtro `returned_at`, `signatureLabel(status)`
- [ ] T048 [US5] Criar `src/shared/db/repositories/employee-epi-record.ts`: `getEmployeeEpiRecord(orgId, employeeId, query)` — `withOrg`, join `epi_deliveries × epi_delivery_items × epi_catalog` filtrado por `employee_id`; colunas `ca/epiName/size/quantity/deliveryDate/returnedAt/signatureStatus`; ordem `delivery_date DESC`; paginação `{rows,total}`; funcionário inexistente/cross-tenant → `NotFoundError`; sem entregas → `{rows:[],total:0}`
- [ ] T049 [US5] Adicionar `getEmployeeEpiRecordAction(employeeId, query)` (via `officeAction`, leitura) em `src/shared/server/actions/pgr/` (arquivo `epi-record.ts` ou reuso de `epi-deliveries.ts`)
- [ ] T050 [P] [US5] Criar `src/app/api/v1/employees/[id]/epi-record/route.ts`: `GET` (read-only, query `?status=&from=&to=&page=`) via `restHandler`
- [ ] T051 [P] [US5] Criar `src/app/(protected)/employees/[id]/_components/epi-record-table.tsx`: ficha read-only (reusa `_ui/list`), filtros de status/período, botão "Imprimir" com CSS `@media print`
- [ ] T052 [US5] Integrar a seção "Ficha de EPI" na `src/app/(protected)/employees/[id]/page.tsx`
- [ ] T053 [P] [US5] Registrar `GET /employees/[id]/epi-record` em `docs/api/api-design.md` + request no Postman (pasta `epi-record`)
- [ ] T054 [P] [US5] Teste unit `src/__tests__/unit/epi-record-filters.test.ts`: status→`returned_at`, filtro de período, `signatureLabel`
- [ ] T055 [US5] Teste integração `src/__tests__/integration/employee-epi-record.test.ts` (Postgres efêmero): ficha não cruza tenant (`NOT_FOUND`); filtros retornam subconjunto correto; funcionário sem entregas → vazio; `FORBIDDEN` para `client`

**Checkpoint**: todas as US independentes e funcionais.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T056 Rodar `npm run check` (format + lint + typecheck + unit) e corrigir pendências
- [ ] T057 Rodar `npm run test:integration` (Postgres efêmero) e garantir verde em toda a fatia
- [ ] T058 Validar o `quickstart.md` ponta a ponta (US1–US5 manuais + migration `0010` aplicada/reversível)
- [ ] T059 Conferir a superfície de API completa por recurso (Server Action + REST + `api-design.md` + Postman) — checklist do CLAUDE.md
- [ ] T060 Housekeeping (via `gh`, não é código): fechar #70 e #72 (já mergeadas); marcar #18 e #115 concluídas e **#75 como duplicada de #115**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup; **bloqueia US2/US3/US4** (erros + `applyStockExit/Entry`). US1 **não** depende dela.
- **US1 (Phase 3)**: ortogonal — pode começar a qualquer momento (após Setup).
- **US2 (Phase 4)**: após Phase 2.
- **US3 (Phase 5)**: após Phase 2 + US2 (entrega existente).
- **US4 (Phase 6)**: após Phase 2 + US2; contém a migration `0010`.
- **US5 (Phase 7)**: após US2 + coluna `returned_at` (T037/T038 da US4). Se US5 preceder US4, a coluna "Data de Devolução" fica sempre vazia — por isso US4 antes de US5.
- **Polish (Phase 8)**: após as US desejadas.

### Ordem recomendada (single-dev)

Setup → Foundational → **US1** (rápida, ortogonal) → **US2** (MVP) → **US3** → **US4** → **US5** → Polish.

### Parallel Opportunities

- Phase 2: T003/T004/T005 [P] (arquivos de erro distintos); depois T006; T007 (refactor) e seu teste T008 [P].
- US1 é paralelizável com a Phase 2 (times diferentes).
- Dentro de US2: T018/T019/T020 (routes distintas) [P] após o repo (T015/T016); T021/T022 (componentes) [P]; T024/T025 [P].
- Dentro de US3: T027/T028/T033 [P]; US4: T042/T044/T045 [P]; US5: T047/T050/T051/T053/T054 [P].

---

## Parallel Example: User Story 2

```bash
# Após o repositório (T015/T016), as rotas REST são arquivos distintos:
Task: "GET/POST em src/app/api/v1/epi-deliveries/route.ts"          # T018
Task: "GET/PUT/DELETE em src/app/api/v1/epi-deliveries/[id]/route.ts" # T019
Task: "POST em src/app/api/v1/epi-deliveries/[id]/sign/route.ts"     # T020
# E os componentes de UI:
Task: "deliver-epi.tsx"        # T021
Task: "delivery-signature.tsx" # T022
```

---

## Implementation Strategy

### MVP First

1. Setup + Foundational.
2. **US1** (autofill CA) → validar → demo.
3. **US2** (entrega + baixa + assinatura manual) → validar → **MVP entregável**.
4. STOP & VALIDATE isolamento multi-tenant (caminho crítico) antes de seguir.

### Incremental Delivery

US1 → US2 (MVP) → US3 (assinatura pública) → US4 (devolução + `0010`) → US5 (ficha). Cada história agrega
valor sem quebrar as anteriores.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- Toda escrita passa por `withOrg` + RLS; tenant da sessão, nunca do cliente (exceção: rota pública
  `/sign`, tenant resolvido do token — R1).
- Testes de integração **sempre** contra Postgres efêmero (`INTEGRATION_*`), nunca SQLite.
- Verificar que os testes falham antes de implementar (regra de negócio nova); a extração da #72 (T007)
  é refactor — os testes existentes devem **continuar** verdes.
- Commit por tarefa ou grupo lógico; nunca co-autoria de Claude (regra da empresa).
