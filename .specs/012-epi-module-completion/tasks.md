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

- [x] T001 Adicionar `EPI_SIGN_TOKEN_SECRET` ao `.env.example` e à documentação de env do `README`/`CLAUDE.md` (segredo do token de assinatura — Princípio V; nunca commitar valor real)
- [x] T002 Garantir que o ambiente de integração (`INTEGRATION_DATABASE_URL`) sobe com as migrations `0001–0009` aplicadas via `src/__tests__/integration/_helpers/db.ts` (nenhuma mudança de código; validação de baseline antes da `0010`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: infra compartilhada por US2/US3/US4 — códigos de erro do contrato e a extração dos helpers
de saldo (D2). **⚠️ Nenhuma US com escrita começa antes desta fase.**

- [x] T003 [P] Criar `src/shared/errors/already-signed-error.ts` (`AlreadySignedError` estende `AppError`, `code = "ALREADY_SIGNED"`) — espelho de `insufficient-stock-error.ts`
- [x] T004 [P] Criar `src/shared/errors/already-returned-error.ts` (`AlreadyReturnedError`, `code = "ALREADY_RETURNED"`)
- [x] T005 [P] Criar `src/shared/errors/token-error.ts` (`TokenInvalidError` `code = "TOKEN_INVALID"`; `TokenExpiredError` `code = "TOKEN_EXPIRED"`)
- [x] T006 Estender `HTTP_BY_CODE` em `src/shared/api/rest.ts`: `ALREADY_SIGNED → 409`, `ALREADY_RETURNED → 409`, `TOKEN_INVALID → 404`, `TOKEN_EXPIRED → 410` (não mexer em `toActionError`, que já converte qualquer `AppError`)
- [x] T007 Refatorar `src/shared/db/repositories/stock-movements.ts` (D2/R3): extrair `applyStockExit(tx, {orgId, stockId, quantity, deliveryId?, type})` e `applyStockEntry(tx, {orgId, stockId, quantity, deliveryId?, type})` recebendo o `tx` da transação-mãe (`SELECT … FOR UPDATE` → valida/aplica saldo → INSERT movimento com `deliveryId` → UPDATE saldo → retorna novo saldo); `registerStockExit`/`registerStockEntry` passam a chamar os helpers **sem** mudar sua assinatura pública
- [x] T008 [P] Teste unit `src/__tests__/unit/stock-movements-helpers.test.ts`: `applyStockExit` valida `balance - qty >= 0` (`InsufficientStockError`), `applyStockEntry` soma; ambos aceitam `deliveryId` — cobrir que o comportamento de `registerStockExit/Entry` (#72) permanece idêntico
- [x] T009 Rodar `npm run test -- --selectProjects unit -t "stock"` e a suíte de integração existente de `stock-movements` para confirmar que a extração **não** regrediu a #72

**Checkpoint**: contrato de erro pronto + helpers de saldo reutilizáveis. US2/US4 podem começar.

---

## Phase 3: User Story 1 — Autofill de CA no catálogo (Priority: P1) 🎯 MVP-A

**Goal**: ao informar um CA no cadastro de EPI, autopreencher fabricante/norma/validade com indicação de
vigência, sem nunca bloquear o salvar (#18/#115/#75).

**Independent Test**: `/epi-catalog/new` → CA vigente autopreenche + badge verde; CA inexistente avisa e
ainda salva.

**Nota**: US1 é ortogonal — não depende da Phase 2. Pode ser feita em paralelo.

- [x] T010 [US1] Converter em estado controlado (`useState`) os campos `ca`, `caValidUntil`, `manufacturer`, `norm` no `src/app/(protected)/epi-catalog/_components/epi-catalog-form.tsx` (hoje `TextField` com `defaultValue`); `handleSubmit` passa a ler esses do estado
- [x] T011 [US1] Trocar o `TextField` de CA pelo `CaField` (`src/shared/integrations/caepi/client/ca-field.tsx`) no mesmo form, ligando `value`/`onChange` ao estado e `onFound` para escrever `manufacturer`/`norm`/`caValidUntil` (cópia por valor); campos seguem editáveis
- [x] T012 [P] [US1] Teste unit `src/__tests__/unit/epi-catalog-form-caepi.test.tsx`: `onFound` autofila em `valid` e `expired`, **não** em `not_found`; submeter com CA vazio/inválido **não** bloqueia (mocka `useCaepiValidation`)
- [x] T013 [US1] Verificar reuso: a integração da CAEPI (lookup 3 estados + base vazia + guarda de sessão) já é coberta pela fatia 011 — **não** reimplementar; registrar no PR que a cobertura é reusada

**Checkpoint**: US1 funcional e demonstrável isoladamente (zero migration, modelo intacto).

---

## Phase 4: User Story 2 — Entrega + baixa + assinatura manual (Priority: P1) 🎯 MVP-B

**Goal**: registrar entrega de N EPIs com baixa atômica de estoque e assinatura manual (#19 core).

**Independent Test**: selecionar itens com saldo → confirmar entrega → saldo cai; entrega `pending`;
"Registrar assinatura manual" muda status; saldo insuficiente → nada gravado.

**Depends on**: Phase 2 (erros + `applyStockExit`).

### Domínio & repositório

- [x] T014 [P] [US2] Criar `src/shared/domains/pgr/epi-deliveries.ts`: `createDeliverySchema` (`employeeId` uuid, `deliveryDate` date, `items` array min 1 de `{stockId uuid, quantity int>0}`), `signManualSchema`, tipos `CreateDeliveryInput`/`DeliveryRow`/`DeliveryDetail` + regra pura de transição de assinatura (só de `pending`)
- [x] T015 [US2] Criar `src/shared/db/repositories/epi-deliveries.ts` com `createDelivery(orgId, input)` (R8): `withOrg` + transação — insere `epi_deliveries` (`pending`); por item faz `SELECT … FOR UPDATE` do `epi_stock` (deriva `catalogId`), insere `epi_delivery_items`, chama `applyStockExit(tx, {type:'employee_delivery', deliveryId})`; falha em qualquer item → rollback total; envolver em `auditedTenantWrite`
- [x] T016 [US2] No mesmo repositório: `getDelivery(orgId, id)` (itens + status; `NotFoundError` cross-tenant), `listDeliveries(orgId, params)` (paginado `{rows,total}`, filtro `employeeId`), `deleteDelivery(orgId, id)` (**guard**: `signature_status != 'pending'` → `ForbiddenError`), `signDeliveryManual(orgId, id)` (transição `pending → signed_manual` + timestamp; senão `AlreadySignedError`) — invariante: o `updated_at` da transição é o timestamp legal da assinatura; após `signed_*` nenhum outro UPDATE ocorre em `epi_deliveries` (sem PUT, delete barrado, devolução escreve só em `epi_delivery_items`)

### Server Actions & REST

- [x] T017 [US2] Criar `src/shared/server/actions/pgr/epi-deliveries.ts`: `createDeliveryAction`, `listDeliveriesAction`, `getDeliveryAction`, `deleteDeliveryAction`, `signDeliveryManualAction` — via `officeAction` (`audit:true` nas mutações), retornando `ActionResult<T>`
- [x] T018 [P] [US2] Criar `src/app/api/v1/epi-deliveries/route.ts`: `GET` (list) + `POST` (create, `201`) via `restHandler`, reusando repo/zod/`toActionError`
- [x] T019 [P] [US2] Criar `src/app/api/v1/epi-deliveries/[id]/route.ts`: `GET` + `DELETE` (`204`; `FORBIDDEN` se assinada) — **sem** `PUT`: edição de entrega está fora de escopo (YAGNI); entregas são imutáveis após a criação, exceto pelas transições de assinatura/devolução
- [x] T020 [P] [US2] Criar `src/app/api/v1/epi-deliveries/[id]/sign/route.ts`: `POST` (assinatura manual) via `restHandler`

### UI

- [x] T021 [P] [US2] Criar `src/app/(protected)/employees/[id]/_components/deliver-epi.tsx`: seleção de itens **com saldo disponível** (checkbox · CA · EPI · Tam. · Und. · Disponível · Quantidade; busca por CA/nome — fonte de dados: `listEpiStock` existente com `withBalanceOnly: true` + `search`, fatia 010; nenhum backend novo) → modal "Preparar entrega" (data) → confirmar (chama `createDeliveryAction`)
- [x] T022 [P] [US2] Criar `src/app/(protected)/employees/[id]/_components/delivery-signature.tsx` (parte manual): botão "Registrar assinatura manual" (chama `signDeliveryManualAction`) + exibição do status
- [x] T023 [US2] Integrar na `src/app/(protected)/employees/[id]/page.tsx` a seção "Entregas de EPI" (lista + ação de entregar + status de assinatura)

### Docs & testes

- [x] T024 [P] [US2] Registrar o recurso `epi-deliveries` em `docs/api/api-design.md` (tabelas "Recursos" e "Sumário": verbos, filtros, códigos) e adicionar a pasta `epi-deliveries` em `docs/api/sst-manager.postman_collection.json` (GET/POST + [id] GET/DELETE + [id]/sign, reusando Variables)
- [x] T025 [P] [US2] Teste unit `src/__tests__/unit/epi-deliveries-domain.test.ts`: `createDeliverySchema` (itens min 1, quantidade>0), transição de assinatura + `ALREADY_SIGNED`
- [x] T026 [US2] Teste integração `src/__tests__/integration/epi-deliveries.test.ts` (Postgres efêmero): baixa atômica multi-item reduz saldo; item sem saldo → `INSUFFICIENT_STOCK` + **saldo intacto** (rollback total); `DELETE` de entrega assinada → `FORBIDDEN`; alvo cross-tenant → `NOT_FOUND`; `FORBIDDEN` para papel `client`; GRANT/RLS por papel

**Checkpoint**: US1 + US2 funcionam de forma independente. **MVP entregável.**

---

## Phase 5: User Story 3 — Assinatura pública QR/link (Priority: P1)

**Goal**: funcionário assina o recebimento por QR/link na rota pública `/sign/[token]`, sem login; painel
do gestor reflete por polling (#19 assinatura).

**Independent Test**: gerar QR/link de uma entrega `pending` → abrir `/sign/<token>` sem sessão →
assinar → status vira `signed_qr/link` e o painel atualiza.

**Depends on**: Phase 2 (erros de token) + US2 (a entrega precisa existir).

- [x] T027 [P] [US3] Criar `src/shared/integrations/epi-signature/token.ts`: `signToken({orgId, deliveryId, method})` e `verifyToken(token)` HMAC-SHA256 stateless (payload `{orgId, deliveryId, method, iat}`, `base64url`, segredo `EPI_SIGN_TOKEN_SECRET`; o `method` é embutido e assinado — a rota pública nunca confia no método vindo do cliente); `verifyToken` retorna payload ou lança `TokenInvalidError`/`TokenExpiredError` (TTL 72h) — R2
- [x] T028 [P] [US3] Teste unit `src/__tests__/unit/epi-signature-token.test.ts`: round-trip sign/verify (payload preserva `method`); assinatura adulterada → `TOKEN_INVALID`; `iat` além de 72h → `TOKEN_EXPIRED`
- [x] T029 [US3] Estender `src/shared/db/repositories/epi-deliveries.ts`: `generateSignToken(orgId, id, method)` (gera token, grava `auth_token`, só se `pending`) e `signByToken(token)` — verifica token (o `method` vem do payload assinado, nunca do cliente) → `withOrg(orgId)` carrega entrega `WHERE id=deliveryId AND auth_token=token` → transição `pending → signed_qr|signed_link` conforme o `method` do token + timestamp (idempotente; já assinada → mensagem, sem 500) — R1
- [x] T030 [US3] Adicionar em `src/shared/server/actions/pgr/epi-deliveries.ts`: `generateSignTokenAction(id, method)` (via `officeAction`, retorna `{token, url, qrSvg}`) e `submitSignatureAction(token)` (**sem** `requireOfficeStaff` — credencial é o token; o método vem do payload do token; valida e chama `signByToken`)
- [x] T031 [US3] Adicionar `"/sign/(.*)"` ao `isPublicRoute` em `src/proxy.ts` (padrão `sign-in`/`webhooks`) e incluir `/sign` em `NO_STORE_PATH_PREFIXES`
- [x] T032 [US3] Criar `src/app/(public)/sign/[token]/page.tsx`: `GET` verifica token e renderiza itens + `<canvas>` de assinatura (token inválido/expirado/entrega assinada → páginas de negócio, sem 500); `POST`/action chama `submitSignatureAction`; anti-enumeração: resposta uniforme (token adulterado ≡ inexistente → `TOKEN_INVALID`) e espaço de chave HMAC — rate-limit por IP é controle complementar na borda (Cloudflare/WAF, infraestrutura), não no app
- [x] T033 [P] [US3] Criar gerador de QR como SVG em `src/shared/integrations/epi-signature/qr.ts` (função pura **ou** dependência leve sem binário nativo, conforme R4) usado pelo `generateSignTokenAction` — R4
- [x] T034 [US3] Estender `delivery-signature.tsx` (US2): botões "Gerar QR" / "Gerar link", exibição do QR/URL e painel "Aguardando confirmação" com **polling** do `signature_status`
- [x] T035 [P] [US3] Documentar a rota pública `/sign/[token]` em `docs/api/api-design.md` (seção de rotas públicas/integrações) e adicionar pasta `sign` no Postman (GET/POST com variável `{token}`)
- [x] T036 [US3] Teste integração `src/__tests__/integration/epi-sign-public.test.ts` (Postgres efêmero): assinatura pública muda `signature_status` **sem** tenant no contexto e **sem** vazar entre orgs; token de outra org não acessa entrega alheia; token expirado → `TOKEN_EXPIRED`; entrega já assinada → sem 500

**Checkpoint**: US1 + US2 + US3 independentes. Ciclo de assinatura completo (manual + pública).

---

## Phase 6: User Story 4 — Devolução + reposição de saldo (Priority: P2)

**Goal**: devolver um EPI entregue repõe o saldo e marca `returned_at`; barra devolução dupla (#20).
**Única história com migration (`0010`).**

**Independent Test**: devolver um item → saldo sobe pela quantidade; 2ª devolução → barrada.

**Depends on**: Phase 2 (`applyStockEntry`) + US2 (entregas existentes).

- [x] T037 [US4] Editar `src/shared/db/schema/epis.ts`: adicionar `"employee_return"` ao pgEnum `stockMovementType` e `returnedAt: timestamp("returned_at", {withTimezone:true})` (nullable) em `epiDeliveryItems`
- [x] T038 [US4] Gerar a migration com `npm run db:generate` e editar para `src/shared/db/migrations/0011_epi_delivery_return.sql` (SQL custom padrão 0005): `ALTER TYPE "stock_movement_type" ADD VALUE IF NOT EXISTS 'employee_return';` `--> statement-breakpoint` `ALTER TABLE "epi_delivery_items" ADD COLUMN "returned_at" timestamptz;` — cabeçalho documenta enum forward-only (R5); aplicar com `npm run db:migrate`
- [x] T039 [US4] Estender `src/shared/domains/pgr/epi-deliveries.ts`: `returnSchema` (`{ itemId: uuid }`) + regra de guard (`returned_at IS NULL`)
- [x] T040 [US4] Estender `src/shared/db/repositories/epi-deliveries.ts`: `returnDeliveryItem(orgId, deliveryId, itemId)` — `withOrg` + transação: valida item no tenant e `returned_at IS NULL` (senão `AlreadyReturnedError`) → seta `returned_at = now()` → `applyStockEntry(tx, {type:'employee_return', deliveryId, +quantity})`; independe do status de assinatura; rollback total em falha
- [x] T041 [US4] Adicionar `returnDeliveryItemAction(deliveryId, itemId)` em `src/shared/server/actions/pgr/epi-deliveries.ts` (via `officeAction`, `audit:true`)
- [x] T042 [P] [US4] Criar `src/app/api/v1/epi-deliveries/[id]/return/route.ts`: `POST` (body `{itemId}`) via `restHandler`
- [x] T043 [P] [US4] Adicionar ação "Devolver" por item na UI da entrega (`delivery-signature.tsx` ou seção de itens em `employees/[id]/page.tsx`), chamando `returnDeliveryItemAction` e refletindo `returned_at`
- [x] T044 [P] [US4] Registrar `POST /epi-deliveries/[id]/return` em `docs/api/api-design.md` + request no Postman (pasta `epi-deliveries`)
- [x] T045 [P] [US4] Teste unit `src/__tests__/unit/epi-return-guard.test.ts`: guard `returned_at` (não devolve 2×); `applyStockEntry` repõe exatamente `+quantity`
- [x] T046 [US4] Teste integração `src/__tests__/integration/epi-return.test.ts` (Postgres efêmero): devolução repõe saldo exato (`FOR UPDATE`); 2ª devolução → `ALREADY_RETURNED` + saldo intacto; item cross-tenant → `NOT_FOUND`; devolução independe de assinatura; `FORBIDDEN` para `client`

**Checkpoint**: ciclo de vida do EPI fechado (entrega ↔ devolução).

---

## Phase 7: User Story 5 — Ficha/histórico por funcionário (Priority: P2)

**Goal**: ficha somente-leitura das entregas/devoluções de um funcionário, com filtros e impressão (#21).

**Independent Test**: abrir a ficha de um funcionário → lista com colunas → filtrar status/período →
imprimir.

**Depends on**: US2 (entregas) + coluna `returned_at` da `0010` (US4) para a coluna "Data de Devolução".

- [x] T047 [P] [US5] Criar `src/shared/domains/pgr/epi-record.ts`: `epiRecordQuerySchema` (`status? pendente|devolvido|todos`, `from?`, `to?`, `page?`, `pageSize?`), mapeamento status→filtro `returned_at`, `signatureLabel(status)`
- [x] T048 [US5] Criar `src/shared/db/repositories/employee-epi-record.ts`: `getEmployeeEpiRecord(orgId, employeeId, query)` — `withOrg`, join `epi_deliveries × epi_delivery_items × epi_catalog` filtrado por `employee_id`; colunas `ca/epiName/size/quantity/deliveryDate/returnedAt/signatureStatus`; ordem `delivery_date DESC`; paginação `{rows,total}`; funcionário inexistente/cross-tenant → `NotFoundError`; sem entregas → `{rows:[],total:0}`
- [x] T049 [US5] Adicionar `getEmployeeEpiRecordAction(employeeId, query)` (via `officeAction`, leitura) em `src/shared/server/actions/pgr/` (arquivo `epi-record.ts` ou reuso de `epi-deliveries.ts`)
- [x] T050 [P] [US5] Criar `src/app/api/v1/employees/[id]/epi-record/route.ts`: `GET` (read-only, query `?status=&from=&to=&page=`) via `restHandler`
- [x] T051 [P] [US5] Criar `src/app/(protected)/employees/[id]/_components/epi-record-table.tsx`: ficha read-only (reusa `_ui/list`), filtros de status/período, botão "Imprimir" com CSS `@media print`
- [x] T052 [US5] Integrar a seção "Ficha de EPI" na `src/app/(protected)/employees/[id]/page.tsx`
- [x] T053 [P] [US5] Registrar `GET /employees/[id]/epi-record` em `docs/api/api-design.md` + request no Postman (pasta `epi-record`)
- [x] T054 [P] [US5] Teste unit `src/__tests__/unit/epi-record-filters.test.ts`: status→`returned_at`, filtro de período, `signatureLabel`
- [x] T055 [US5] Teste integração `src/__tests__/integration/employee-epi-record.test.ts` (Postgres efêmero): ficha não cruza tenant (`NOT_FOUND`); filtros retornam subconjunto correto; funcionário sem entregas → vazio; `FORBIDDEN` para `client`

**Checkpoint**: todas as US independentes e funcionais.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T056 Rodar `npm run check` (format + lint + typecheck + unit) e corrigir pendências
- [x] T057 Rodar `npm run test:integration` (Postgres efêmero) e garantir verde em toda a fatia
- [ ] T058 Validar o `quickstart.md` ponta a ponta (US1–US5 manuais + migration `0010` aplicada/reversível)
- [x] T059 Conferir a superfície de API completa por recurso (Server Action + REST + `api-design.md` + Postman) — checklist do CLAUDE.md
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
- **US5 (Phase 7)**: após US2 + T037/T038 da US4 (dependência **dura** de schema: sem a migration `0010` a coluna `returned_at` não existe e a query da ficha falharia). Basta a migration aplicada — o restante da US4 (repo/UI de devolução) pode seguir em paralelo à US5.
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
Task: "GET/DELETE em src/app/api/v1/epi-deliveries/[id]/route.ts"    # T019
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
