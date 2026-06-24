---
description: "Task list — Modelo de dados do módulo de EPIs (008)"
---

# Tasks: Modelo de dados do módulo de EPIs

**Input**: Design documents from `.specs/008-epi-data-model/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: INCLUÍDOS — testes são obrigatórios nesta base (Constituição §Quality Gates;
SC-007). Integração de RLS/constraints roda contra **Postgres efêmero** (`INTEGRATION_*`),
nunca SQLite.

**Organization**: tarefas agrupadas por user story (spec.md). Itens marcados `[x]` já estão
implementados na branch (as-built — ver research.md); itens `[ ]` são o trabalho restante.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 (isolamento) · US2 (catálogo) · US3 (estoque/movimentos/entregas) · US4 (risco)
- Caminhos de arquivo exatos em cada tarefa

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: ambiente pronto para gerar migration e rodar testes.

- [x] T001 Garantir dependências instaladas (`npm install`: drizzle-orm, drizzle-kit, postgres, zod, jest)
- [x] T002 [P] Confirmar `DATABASE_URL_UNPOOLED` disponível para `drizzle-kit generate` (não conecta; só exigido pela `drizzle.config.ts`)
- [x] T003 [P] Confirmar scripts de teste: `npm run test` (unit) e `npm run test:integration` (Postgres efêmero) em `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema base + migration + validação que TODAS as stories consomem.

**⚠️ CRITICAL**: nenhuma story é verificável até esta fase concluir.

- [x] T004 Criar enums `stock_movement_type` e `epi_signature_status` em `src/shared/db/schema/epis.ts`
- [x] T005 Definir as 6 tabelas (`epiCatalog`, `epiStock`, `stockMovements`, `epiDeliveries`, `epiDeliveryItems`, `epiRisk`) com PK uuid, `org_id`→orgs.id indexado, timestamps, FKs e índices em `src/shared/db/schema/epis.ts`
- [x] T006 Habilitar RLS + `pgPolicy("<t>_isolation", …)` (`app_runtime`, GUC `app.current_org`) nas 6 tabelas em `src/shared/db/schema/epis.ts`
- [x] T007 Exportar tabelas/enums/tipos em `src/shared/db/schema/index.ts`
- [x] T008 [P] Adicionar `stockMovementTypeSchema`, `epiSignatureStatusSchema`, `epiQuantitySchema` em `src/shared/domains/pgr/validation.ts`
- [x] T009 Gerar `src/shared/db/migrations/0007_epi_data_model.sql` via `drizzle-kit generate` (+ snapshot/journal em `meta/`)
- [x] T010 Acrescentar à mão na `0007_*.sql` os `GRANT … TO app_runtime` e `CREATE TRIGGER set_updated_at_<t>` das 6 tabelas (padrão da 0005)
- [x] T011 [P] Estender o seed `src/__tests__/integration/_helpers/pgr-seed.ts` com a cadeia EPI por tenant (catálogo→estoque→movimento, entrega→item, risco)

**Checkpoint**: schema + migration prontos — verificação por story pode começar.

---

## Phase 3: User Story 1 — Isolamento por tenant em todo o domínio (Priority: P1) 🎯 MVP

**Goal**: nenhum dado de EPI cruza tenants (leitura e escrita) nas 6 tabelas.

**Independent Test**: com org_a/org_b semeados, conectado como `app_runtime` em org_a — leitura
só vê org_a; escrita cross-tenant rejeitada (rodar as 6 suítes de isolamento).

### Tests for User Story 1

- [x] T012 [P] [US1] `epi-catalog-isolation.test.ts` (`runIsolationSuite`) em `src/__tests__/integration/shared/db/`
- [x] T013 [P] [US1] `epi-stock-isolation.test.ts` em `src/__tests__/integration/shared/db/`
- [x] T014 [P] [US1] `stock-movements-isolation.test.ts` em `src/__tests__/integration/shared/db/`
- [x] T015 [P] [US1] `epi-deliveries-isolation.test.ts` em `src/__tests__/integration/shared/db/`
- [x] T016 [P] [US1] `epi-delivery-items-isolation.test.ts` em `src/__tests__/integration/shared/db/`
- [x] T017 [P] [US1] `epi-risk-isolation.test.ts` em `src/__tests__/integration/shared/db/`
- [x] T018 [P] [US1] `epi-migration-shape.test.ts` (RLS habilitado, policy `app_runtime`, GRANT, trigger, `org_id` NOT NULL+indexado, enums, FK→categories) em `src/__tests__/integration/shared/db/`

### Implementation for User Story 1

- [x] T019 [US1] (coberto em T006) policies de isolamento nas 6 tabelas — sem trabalho adicional

**Checkpoint**: US1 verificável de forma independente (rodar suítes de isolamento em Postgres efêmero).

---

## Phase 4: User Story 2 — Catálogo com campos do ePGR + consistência de tipo (Priority: P1)

**Goal**: `epi_catalog` persiste todos os campos do ePGR; tipo do item == tipo da categoria
(FR-002a); categoria/catálogo em uso não somem (RESTRICT).

**Independent Test**: criar item EPI completo e item "machine" sem CA/norma; tentar item com
tipo ≠ categoria (rejeitado); excluir categoria em uso (bloqueado).

### Tests for User Story 2

- [x] T020 [P] [US2] `epi-validation.test.ts` (enums + quantidade) em `src/__tests__/unit/domains/pgr/`
- [x] T021 [US2] Casos em `epi-constraints.test.ts`: FK `category_id` RESTRICT; CASCADE catálogo→estoque em `src/__tests__/integration/shared/db/`
- [x] T022 [US2] **(FR-002a)** Adicionar caso em `epi-constraints.test.ts`: inserir item de catálogo com `type` ≠ ao da categoria → rejeitado (e o caminho feliz tipo==tipo passa) em `src/__tests__/integration/shared/db/` — **+ ajustado `epi-migration-shape.test.ts` para a FK composta**

### Implementation for User Story 2

- [x] T023 [US2] Campos do ePGR em `epiCatalog` (type, category_id, name, ca, ca_valid_until, manufacturer, norm, size, unit_of_measure texto livre, description, photo_path) em `src/shared/db/schema/epis.ts`
- [x] T024 [US2] **(FR-002a)** Adicionar **`unique("uq_categories_id_type").on(id, type)`** (UNIQUE constraint, não índice — exigido como alvo de FK) em `src/shared/db/schema/categories.ts`
- [x] T025 [US2] **(FR-002a)** Trocar a FK simples de `categoryId` por **FK composta** `(category_id, type) → categories(id, type)` `ON DELETE RESTRICT` (table-level `foreignKey`, removido `.references()` inline) em `src/shared/db/schema/epis.ts`
- [x] T026 [US2] **(FR-002a)** Gerada `0008_epi_catalog_type_fk.sql` via `drizzle-kit generate` + **reordenada à mão** (UNIQUE antes da FK, senão o Postgres rejeita) em `src/shared/db/migrations/`
- [x] T027 [US2] `npx tsc --noEmit` ✅, `npm run lint` ✅ e `npm run test` (178 unit) ✅ após o delta

**Checkpoint**: catálogo completo + integridade de tipo garantida no banco.

---

## Phase 5: User Story 3 — Estoque, movimentos e entregas (Priority: P2)

**Goal**: estoque (saldo/mínimo ≥ 0, único por item), movimentos tipados (quantidade > 0),
entregas com status de assinatura e token único global.

**Independent Test**: criar estoque, lançar movimentos de cada tipo, criar entrega+itens;
quantidade ≤ 0 e saldo/mínimo negativos rejeitados; token duplicado rejeitado; SET NULL ao
excluir entrega.

### Tests for User Story 3

- [x] T028 [US3] Casos em `epi-constraints.test.ts`: `CHECK quantity > 0` (movimentos e itens), `balance/min_quantity ≥ 0`, `UNIQUE(org, catalog)` estoque, índice parcial de `auth_token`, enums fechados em `src/__tests__/integration/shared/db/`

### Implementation for User Story 3

- [x] T029 [P] [US3] `epiStock` (balance/min_quantity default 0, CHECK ≥ 0, `UNIQUE(org, catalog)`) em `src/shared/db/schema/epis.ts`
- [x] T030 [P] [US3] `stockMovements` (type enum, `CHECK quantity > 0`, movement_date, invoice_number, `delivery_id` SET NULL) em `src/shared/db/schema/epis.ts`
- [x] T031 [P] [US3] `epiDeliveries` (employee_id CASCADE, signature_status default pending, `auth_token` único parcial global) em `src/shared/db/schema/epis.ts`
- [x] T032 [P] [US3] `epiDeliveryItems` (delivery_id CASCADE, catalog_id RESTRICT, `CHECK quantity > 0`) em `src/shared/db/schema/epis.ts`

**Checkpoint**: camada de operação (estoque/movimentos/entregas) modelada e validada.

---

## Phase 6: User Story 4 — Vínculo EPI × risco do GES (Priority: P3)

**Goal**: vincular item a GES com flag `neutralizes`, sem duplicar o par item×GES.

**Independent Test**: criar vínculo; tentar duplicar (org, catalog, ges) → rejeitado.

### Tests for User Story 4

- [x] T033 [US4] Caso em `epi-constraints.test.ts`: `UNIQUE(org, catalog, ges)` em `epi_risk` rejeita duplicata em `src/__tests__/integration/shared/db/`

### Implementation for User Story 4

- [x] T034 [US4] `epiRisk` (catalog_id CASCADE, ges_id CASCADE interino, neutralizes default false, `UNIQUE(org, catalog, ges)`) em `src/shared/db/schema/epis.ts`

**Checkpoint**: todas as 4 stories modeladas e cobertas por testes.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T035 Rodar `npm run test:integration` contra **Postgres efêmero** (`INTEGRATION_DATABASE_URL` + `INTEGRATION_APP_RUNTIME_URL`) e confirmar todas as suítes de EPI verdes (não `skip`)
- [x] T036 [P] Atualizado `docs/briefings/briefing-epi-data-model.md` (§11) registrando o FR-002a (FK composta + migration 0008) como implementado
- [ ] T037 [P] Rodar `quickstart.md` ponta a ponta (passos 1 e 3) e marcar o mapa de aceite
- [x] T038 `npm run test` (unit) e `npm run lint` + tipos verdes localmente
- [x] T039 [P] **(G1/FR-012)** Caso em `epi-constraints.test.ts`: excluir catálogo com entregas é bloqueado (RESTRICT em `epi_delivery_items.catalog_id`)
- [x] T040 [P] **(G2/FR-015)** Caso em `epi-constraints.test.ts`: excluir entrega preserva o movimento e zera `delivery_id` (SET NULL)
- [x] T041 [P] **(G3/FR-014)** Caso em `epi-constraints.test.ts`: excluir funcionário remove entregas e itens em cascata

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)** → **Foundational (P2)** bloqueia todas as stories.
- **US1–US4 (P3–P6)** dependem de Foundational. US1 é o MVP (isolamento — não-negociável).
- **Polish (P7)** depende das stories desejadas.

### Story Dependencies

- US1 (isolamento) — independe das demais; é o gate de segurança.
- US2 (catálogo) — raiz da cadeia; US3 e US4 referenciam o catálogo, mas cada story é testável isoladamente via seed.
- US3, US4 — dependem do schema base (Foundational), não de US2 em runtime de teste (o seed cria o catálogo).

### Trabalho restante (delta) — caminho crítico

T024 → T025 → T026 → (T022 test) → T027 → T035. (FR-002a + verificação em Postgres efêmero.)

### Parallel Opportunities

- T012–T018 (suítes de isolamento) são `[P]` — arquivos distintos.
- T029–T032 (definições de tabela) foram `[P]` no mesmo arquivo `epis.ts` (já feitas).
- T036/T037 (docs/quickstart) `[P]` no polish.

---

## Implementation Strategy

### MVP (US1 — isolamento)

1. Setup + Foundational (já concluídos).
2. Rodar as 6 suítes de isolamento + migration-shape em Postgres efêmero (T012–T018).
3. **VALIDAR**: nenhum dado cruza tenants. Esse é o gate de aceite mais importante.

### Incremental

1. Foundation pronta → US1 (isolamento) validada.
2. US2: aplicar o **delta FR-002a** (T024–T027) + teste T022.
3. US3/US4: já modeladas; validar constraints em Postgres efêmero.
4. Polish: integração completa (T035) + docs (T036) + quickstart (T037).

---

## Notes

- `[x]` = já implementado na branch (as-built). `[ ]` = trabalho restante (FR-002a + verificação de integração).
- O delta real desta fatia é o **FR-002a** (FK composta de consistência de tipo) e rodar a
  integração contra Postgres efêmero — o ambiente atual não tem Docker/Postgres, então T035
  fica pendente até haver um Postgres efêmero.
- Commitar após cada grupo lógico; nunca commitar direto na `main` (feature branch).
