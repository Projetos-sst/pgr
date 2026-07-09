---
description: "Task list — Infraestrutura de assinatura digital (010)"
---

# Tasks: Infraestrutura de assinatura digital (links públicos com token + QR + captura)

**Input**: Design documents from `.specs/010-digital-signature-infra/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUÍDOS — a constituição (§Fluxo / Princípio V) torna testes obrigatórios: unit (lógica/validação) + integração (Server Actions / Route Handlers / queries) contra **Postgres efêmero** (`INTEGRATION_*`), **nunca SQLite**. Escreva os testes antes da implementação e garanta que falham primeiro.

**Organization**: tarefas agrupadas por user story (spec.md). Conteúdo PT-BR; código/identificadores em inglês.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos distintos, sem dependência pendente)
- **[Story]**: US1..US5 (fases de história); Setup/Foundational/Polish sem label

## Path Conventions

Web app Next.js em camadas (plan.md §Project Structure): `src/shared/{db,domains,server,tenant,ui}`, `src/app/(public|protected)`. Testes seguem a convenção do repo (`jest.config.ts`): unit em `src/__tests__/unit/**` e integração agrupada por domínio em `src/__tests__/integration/signatures/**`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependências e pré-requisitos de projeto.

- [x] T001 Adicionar dependências `qrcode` e `signature_pad` (+ `@types/qrcode` se necessário) ao `package.json` e instalar; confirmar compatibilidade com React 19.2.4 / Next 16.2.6 (research D6) e registrar versões fixadas.
- [x] T002 [P] Confirmar que o harness de integração (`src/__tests__/integration/_helpers/db.ts`) aplica a migration nova ao splitar por `--> statement-breakpoint` e que `INTEGRATION_DATABASE_URL` aponta para Postgres efêmero (sem alteração de código além de verificação/ajuste do helper se preciso).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema, migration, domínio puro, helper de token e repositório — compartilhados por todas as histórias.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [x] T003 Criar schema `src/shared/db/schema/signatures.ts`: tabelas `signature_requests` e `signature_captures` + enums `signature_request_status` (`pending|signed|cancelled`) e `signature_method` (`qr|link|manual`), colunas/constraints/índices conforme data-model.md, com RLS — policy de tenant (`FOR ALL`) em ambas e **policy de capability** (`FOR SELECT`, `token_hash = current_setting('app.signature_token', true)`) em `signature_requests` — via `pgPolicy(...).enableRLS()` (template `companies.ts`/`epis.ts`).
- [x] T004 Re-exportar tabelas, enums e tipos `Signature*` em `src/shared/db/schema/index.ts` (depende de T003).
- [x] T005 Gerar migration `npm run db:generate` → `src/shared/db/migrations/0010_digital_signature_infra.sql` (depende de T003/T004).
- [x] T006 Complementar a migration `0009` com SQL custom (padrão `0001`/`0005`): `GRANT SELECT,INSERT,UPDATE,DELETE` ao `app_runtime` nas 2 tabelas; triggers `set_updated_at`; e a **policy de capability** caso o drizzle-kit não a emita (research D10) — separados por `--> statement-breakpoint` (depende de T005).
- [ ] T007 Aplicar a migration `npm run db:migrate` (conexão owner unpooled) e validar criação de tabelas/policies/triggers (depende de T006).
- [x] T008 [P] Implementar `src/shared/domains/signatures/token.ts` (puro): geração de token ≥256 bits (`crypto.randomBytes` → base64url), `hashToken` (sha-256), `isExpired(expiresAt, status, now)` — sem I/O.
- [x] T009 [P] Implementar `src/shared/domains/signatures/schemas.ts` (Zod v4): `createSignatureRequestSchema` (targetType, targetId? uuid, payload, ttlSeconds? **default 259200**), `publicSignatureSchema` (signerName **máx. 120**, imageDataUrl data-URL PNG **máx. 256 KB**), `signManuallySchema` (signerName **máx. 120**) — limites fixos conforme data-model.md.
- [x] T010 [P] Implementar o mecanismo de registry em `src/shared/domains/signatures/contract.ts`: tipo `SignatureTargetType`, tipo `TargetRegistryEntry` (`payloadSchema` + `FormRenderer`), `signatureTargetRegistry` (Record) e acessor `getTargetEntry(type)` (genérico, sem acoplar a `demo`).
- [x] T011 [P] Implementar `src/shared/db/with-signature-token.ts`: `withSignatureToken(rawToken, fn)` que abre transação e `set_config('app.signature_token', sha256(rawToken), true)` (espelha `withOrg`).
- [x] T012 Implementar repositório `src/shared/db/repositories/signature-requests.ts` com `createRequest`, `countRequestsInCurrentMonth`, `getRequestStatusById`, `getRequestByTokenCapability`, `markSignedWithCapture` (UPDATE atômico `WHERE used_at IS NULL` + insert capture), `markSignedManually` — escritas via `auditedTenantWrite` (contracts/repositories.md; depende de T003/T004/T011).
- [x] T013 [P] Unit test `src/__tests__/unit/signatures-token.test.ts`: entropia/formato do token, `hashToken` determinístico, `isExpired` (limites) — deve FALHAR antes de T008.
- [x] T014 [P] Unit test `src/__tests__/unit/signatures-schemas.test.ts`: aceita/rejeita inputs dos schemas, incluindo **rejeição de `imageDataUrl` acima de 256 KB** e `signerName` acima de 120 — deve FALHAR antes de T009.

**Checkpoint**: fundação pronta — histórias podem começar.

---

## Phase 3: User Story 1 — Gerar link/QR assinável sem login (Priority: P1) 🎯 MVP

**Goal**: gerar pedido + link público + QR (exibidos/copiáveis na tela interna); rota pública sem login valida o token e captura a assinatura, persistindo-a vinculada à origem.

**Independent Test**: no painel interno, gerar um pedido (`target_type:'demo'`), **copiar o link / ver o QR**; abrir a URL pública sem sessão → formulário correto exibido → assinar → captura persistida e pedido `signed`. Estados de token inválido/expirado/usado renderizam página amigável; papel `client` é barrado.

### Tests for User Story 1 (Postgres efêmero) ⚠️

- [x] T015 [P] [US1] Integração `src/__tests__/integration/signatures/create.test.ts`: `createSignatureRequest` persiste escopado ao org e retorna `publicUrl`+`qrCodeDataUrl`; `token_hash` gravado (nunca o token cru).
- [x] T016 [P] [US1] Integração `src/__tests__/integration/signatures/submit-public.test.ts`: `submitPublicSignature` via token grava `signature_captures` (`method` link/qr) e transiciona `pending→signed` (`used_at` setado).
- [x] T017 [P] [US1] Integração `src/__tests__/integration/signatures/public-states.test.ts`: token **inexistente** → `NOT_FOUND`; token **expirado** → estado "expirado" sem gravação; token **já utilizado** → estado "já utilizado" sem nova gravação (uso único atômico).
- [x] T018 [P] [US1] Integração `src/__tests__/integration/signatures/cross-tenant.test.ts` (**crítico, manual**): token de `org_a` não lê/grava em `org_b` (policy de capability + `withOrg`); ausência de token não retorna nada.
- [x] T019 [P] [US1] Integração `src/__tests__/integration/signatures/forbidden.test.ts` (FR-026): papel `client` é barrado com `FORBIDDEN` em `createSignatureRequest`/`getSignatureStatus`/`signManually`; office staff (`owner`/`collaborator`) passa.

### Implementation for User Story 1

- [x] T020 [P] [US1] Implementar payload + renderer do consumidor demo em `src/shared/domains/signatures/targets/demo.ts` (`demoPayloadSchema`) e `src/shared/ui/signature/DemoSignatureForm.tsx`, e registrá-lo no `signatureTargetRegistry` (contract.ts).
- [x] T021 [P] [US1] Implementar `src/shared/ui/signature/QrCode.tsx` (exibe data-URL recebido) e `src/shared/ui/signature/SignaturePad.tsx` (`"use client"`, wrapper de `signature_pad`, exporta PNG data-URL).
- [x] T022 [US1] Implementar `createSignatureRequest` em `src/shared/server/actions/signatures.ts` via `officeAction` (`audit:true`): valida com `createSignatureRequestSchema` + `payloadSchema` do registry, gera token, persiste hash via `withOrg(ctx.tenantId)`, gera QR (`qrcode`) a partir do `publicUrl`; retorna `{requestId, publicUrl, qrCodeDataUrl}` (depende de T012/T010/T021). _(o gate de plano entra em US5/T039.)_
- [x] T023 [US1] Implementar `submitPublicSignature` em `src/shared/server/actions/public-signatures.ts` (SEM gate de office): `withSignatureToken` lê o request, valida existência/expiração/`used_at`, deriva `org_id` e grava via `withOrg(orgId)` (`markSignedWithCapture`); retorna estados de erro/derivados (depende de T012/T011/T009).
- [x] T024 [US1] Implementar a rota pública `src/app/(public)/assinar/[token]/page.tsx`: resolve estado (inválido/expirado/usado/válido), renderiza o `FormRenderer` do `target_type` + `SignaturePad`, submete em `submitPublicSignature` (depende de T020/T021/T023; contracts/public-route.md).
- [x] T025 [US1] Implementar o painel interno `src/app/(protected)/signatures/page.tsx`: botão "gerar" (chama `createSignatureRequest`), **copiar link** + exibição do `QrCode` (FR-006) (depende de T022/T021). _(o polling de status entra em US2/T028.)_

**Checkpoint**: US1 funcional e testável de forma independente (geração interna + captura pública).

---

## Phase 4: User Story 2 — Acompanhar a confirmação em tempo real (Priority: P1)

**Goal**: a tela interna reflete `Aguardando → Assinado` sem recarga, em `<5s`.

**Independent Test**: com um pedido `pending` no painel interno, concluir a assinatura na rota pública → o painel mostra `Assinado` sozinho em `<5s`.

### Tests for User Story 2 (Postgres efêmero) ⚠️

- [x] T026 [P] [US2] Integração `src/__tests__/integration/signatures/status.test.ts`: `getSignatureStatus` retorna `pending`, depois `signed` (com `signedAt`) após captura; pedido com `expires_at<now()` e `pending` → `expired` (derivado); request inexistente/cross-tenant → `NOT_FOUND`.

### Implementation for User Story 2

- [x] T027 [US2] Implementar `getSignatureStatus` em `src/shared/server/actions/signatures.ts` via `officeAction` (sem audit): deriva `expired` de `status`+`expires_at` (depende de T012).
- [x] T028 [US2] Adicionar **status com polling ~3s** (`getSignatureStatus`) ao painel `src/app/(protected)/signatures/page.tsx` → `<5s` (depende de T025/T027).

**Checkpoint**: US1 + US2 funcionais de forma independente.

---

## Phase 5: User Story 3 — Reutilização por múltiplos módulos (DRY) (Priority: P1)

**Goal**: provar que a mesma infra serve a vários módulos via o contrato único, sem mudança de schema ao adicionar um consumidor.

**Independent Test**: registrar um segundo `target_type` (fixture) e criar/assinar um pedido para ele funciona; o caminho de plug-in está documentado e não exige migração.

### Tests for User Story 3 (Postgres efêmero) ⚠️

- [x] T029 [P] [US3] Integração `src/__tests__/integration/signatures/extensibility.test.ts`: registrar um `target_type` de fixture no registry e executar create→submit prova reuso sem alterar schema (mesmas tabelas/colunas).

### Implementation for User Story 3

- [x] T030 [US3] Garantir que `contract.ts` é genérico (nenhuma referência a `demo` fora do registry) e expor o acesso ao registry consumível por qualquer módulo; ajustar tipos se necessário (depende de T010/T020).
- [x] T031 [P] [US3] Documentar o caminho de plug-in (registrar `target_type` + `payloadSchema` + `FormRenderer`, zero migração) consolidando `contracts/public-route.md` e referenciando o exemplo `epi_delivery` da branch irmã (sem código de EPI nesta fatia).

**Checkpoint**: contrato comprovadamente reutilizável; US1–US3 (P1) completas = MVP da fatia.

---

## Phase 6: User Story 4 — Assinatura manual (fallback) (Priority: P2)

**Goal**: registrar assinatura manual para um pedido `pending`, identificada como manual.

**Independent Test**: marcar um pedido `pending` como assinado manualmente → `signed` com `method='manual'`.

### Tests for User Story 4 (Postgres efêmero) ⚠️

- [x] T032 [P] [US4] Integração `src/__tests__/integration/signatures/manual.test.ts`: `signManually` cria captura `method='manual'`, transiciona `pending→signed`; rejeita pedido já `signed` (uso único).

### Implementation for User Story 4

- [x] T033 [US4] Implementar `signManually` em `src/shared/server/actions/signatures.ts` via `officeAction` (`audit:true`): valida `signManuallySchema`, grava via `withOrg` (`markSignedManually`) (depende de T012).
- [x] T034 [US4] Adicionar ação de **assinatura manual** ao painel `src/app/(protected)/signatures/page.tsx` para pedidos `pending` (depende de T028/T033).

**Checkpoint**: US1–US4 funcionais.

---

## Phase 7: User Story 5 — Limite de uso por plano (Priority: P3)

**Goal**: free limitado a 10 pedidos/mês; pro ilimitado; plano do tenant ativo; rota pública nunca checa plano.

**Independent Test**: tenant free bloqueado na 11ª criação no mês (`QUOTA_EXCEEDED`); pro nunca; rota pública não bloqueia.

### Tests for User Story 5 ⚠️

- [x] T035 [P] [US5] Unit `src/__tests__/unit/signatures-quota.test.ts`: `isSignatureAvailable(plan, count)` — `pro` sempre true; `free` false em `count>=FREE_SIGNATURE_MONTHLY_QUOTA` — deve FALHAR antes de T037.
- [x] T036 [P] [US5] Integração `src/__tests__/integration/signatures/quota.test.ts` (Postgres efêmero): free bloqueado na 11ª criação no mês (`QUOTA_EXCEEDED`); pro cria além de 10; rota pública (`submitPublicSignature`) não checa plano.

### Implementation for User Story 5

- [x] T037 [P] [US5] Adicionar helpers em `src/shared/tenant/plan.ts`: `FREE_SIGNATURE_MONTHLY_QUOTA = 10` e `isSignatureAvailable(plan, currentCount)` (puro), ao lado de `isTeamManagementAvailable`.
- [x] T038 [P] [US5] Criar `QuotaExceededError` (extends `AppError`, `code='QUOTA_EXCEEDED'`, `status=402`) em `src/shared/errors/` e adicionar `QUOTA_EXCEEDED → 402` ao `HTTP_BY_CODE` em `src/shared/api/rest.ts`.
- [x] T039 [US5] Cablear o gate em `createSignatureRequest` (`src/shared/server/actions/signatures.ts`): se `ctx.plan==='free'` e `countRequestsInCurrentMonth >= FREE_SIGNATURE_MONTHLY_QUOTA` → lançar `QuotaExceededError`; `pro` ilimitado (depende de T022/T037/T038).

**Checkpoint**: todas as histórias funcionais e isoladamente testáveis.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T040 [P] Garantir auditoria sem PII em todas as escritas (`logTenantEvent` via `officeAction`/`auditedTenantWrite`) e ausência de token cru/imagem em logs.
- [x] T041 [P] Atualizar `quickstart.md` se algum caminho mudou e executar a validação manual ponta a ponta (gerar → assinar → status `<5s`; estados expirado/usado/inválido).
- [x] T042 Rodar `npm run check` (format:check + lint + typecheck + unit) e `npm run test:integration` — todos verdes (gate de conclusão).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: sem dependências.
- **Foundational (P2)**: depende de Setup; **bloqueia todas as histórias**. Ordem rígida no eixo de banco: T003→T004→T005→T006→T007. T008–T011 paralelos; T012 depende de T003/T004/T011.
- **US1 (P3)**: depende de Foundational. **MVP** (geração interna + captura pública).
- **US2 (P4)**: depende de Foundational; adiciona polling ao painel de US1 (T028←T025/T027).
- **US3 (P5)**: depende de Foundational + registro demo de US1 (T030←T020).
- **US4 (P6)**: depende de Foundational; UI depende do painel de US2 (T034←T028).
- **US5 (P7)**: depende de US1 (altera `createSignatureRequest`: T039←T022).
- **Polish (P8)**: depois das histórias desejadas.

### Within Each User Story

- Testes escritos e **falhando** antes da implementação.
- Repositório/domínio antes de actions; actions antes de UI; core antes de integração.

### Parallel Opportunities

- Setup: T002 ‖ T001.
- Foundational: T008 ‖ T009 ‖ T010 ‖ T011; T013 ‖ T014.
- US1 testes: T015 ‖ T016 ‖ T017 ‖ T018 ‖ T019; impl: T020 ‖ T021 (antes de T022/T024/T025).
- US5: T037 ‖ T038 antes de T039; T035 ‖ T036.
- Após Foundational, US1/US2/US3 podem ser tocadas em paralelo por devs distintos (respeitando T022→T028, T025→T028 e T020→T030).

---

## Parallel Example: User Story 1

```bash
# Testes de US1 juntos (devem falhar primeiro):
Task: "Integração create em src/__tests__/integration/signatures/create.test.ts"
Task: "Integração submit-public em src/__tests__/integration/signatures/submit-public.test.ts"
Task: "Integração public-states em src/__tests__/integration/signatures/public-states.test.ts"
Task: "Integração cross-tenant em src/__tests__/integration/signatures/cross-tenant.test.ts"
Task: "Integração forbidden em src/__tests__/integration/signatures/forbidden.test.ts"

# Componentes/domínio de US1 juntos:
Task: "Demo payload+renderer em src/shared/domains/signatures/targets/demo.ts + DemoSignatureForm.tsx"
Task: "QrCode.tsx + SignaturePad.tsx em src/shared/ui/signature/"
```

---

## Implementation Strategy

### MVP First (US1–US3, todas P1)

1. Phase 1 Setup → Phase 2 Foundational (crítico, bloqueia tudo).
2. US1 (gerar/QR interno + captura pública) → validar isoladamente.
3. US2 (status em tempo real) → validar `<5s`.
4. US3 (prova de reuso/DRY) → MVP da fatia completo. Parar e validar.

### Incremental Delivery

- Foundational pronto → US1 (MVP) → US2 → US3 → US4 (manual) → US5 (gate de plano). Cada história agrega valor sem quebrar as anteriores.

---

## Notes

- Testes contra **Postgres efêmero** (`INTEGRATION_*`), **nunca SQLite** — exceção obrigatória da constituição para fatia RLS-dependente.
- Tenant sempre da sessão (interno) ou do token (público), nunca de input do cliente.
- Token cru só na URL/QR; persistir apenas `sha256`. Imagem base64 (≤256 KB) sob RLS por tenant.
- `cancelled` é estado dormente nesta fatia (sem transição automática; ver data-model.md).
- Commitar após cada tarefa ou grupo lógico; rodar `npm run check` antes de concluir cada história.
