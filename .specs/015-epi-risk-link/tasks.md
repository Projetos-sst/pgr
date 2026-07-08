---
description: "Task list — Vínculo EPI × risco com neutralização (015)"
---

# Tasks: Vínculo EPI × risco com neutralização

**Input**: Design documents from `.specs/015-epi-risk-link/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: INCLUÍDOS — obrigatórios nesta base (Constituição §Quality Gates; SC-007). Integração de
CRUD/isolamento roda contra **Postgres efêmero** (`INTEGRATION_*`), nunca SQLite.

**Organization**: tarefas agrupadas por user story (spec.md). Itens `[x]` já estão implementados na
branch (as-built — commit `ce884a9`); itens `[ ]` são validação em ambiente / follow-up de rebase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 (isolamento) · US2 (vincular c/ neutralização) · US3 (descoberta + UI)
- Caminhos de arquivo exatos em cada tarefa

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: ambiente pronto para gerar a migration de evolução e rodar os testes.

- [x] T001 Confirmar que a tabela `epi_risk` está sem consumidores (nenhum repo/action/UI) e sem dados — pré-condição da migration de baixo risco
- [x] T002 [P] Confirmar `DATABASE_URL_UNPOOLED` disponível para `drizzle-kit generate` (offline)
- [x] T003 [P] Confirmar scripts `npm run check` / `npm run test:integration` em `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema evoluído + migration + domínio Zod + seed/testes dependentes atualizados — base que todas as stories consomem.

**⚠️ CRITICAL**: nenhuma story é verificável até esta fase concluir.

- [x] T004 Adicionar `pgEnum epiNeutralization` (`neutralizes`/`does_not_neutralize`/`not_applicable`) em `src/shared/db/schema/epis.ts`
- [x] T005 Repontar `epiRisk`: `gesId → riskId` (FK `risks.id` cascade, indexado) e `neutralizes boolean → neutralization epiNeutralization` (NOT NULL) + unique `uq_epi_risk_org_catalog_risk` em `src/shared/db/schema/epis.ts`
- [x] T006 [P] Exportar `epiNeutralization` em `src/shared/db/schema/index.ts`
- [x] T007 Escrever à mão `src/shared/db/migrations/0013_epi_risk_link.sql` (CREATE TYPE + drop FK/índices antigos + add colunas/FK/índices + drop colunas antigas); conferir nomes contra `0007_epi_data_model.sql`
- [x] T008 Derivar `meta/0013_snapshot.json` + entrada no `_journal.json` de forma determinística e validar com `npm run db:generate` → "No schema changes"
- [x] T009 [P] Criar domínio Zod em `src/shared/domains/pgr/epi-risk.ts` (`epiNeutralizationSchema` obrigatório, `epiRiskLinkInputSchema`/`epiRiskLinkUpdateSchema`, rótulos pt-BR, view types)
- [x] T010 [P] Atualizar seed `src/__tests__/integration/_helpers/pgr-seed.ts`: insert de `epi_risk` migrado para `risk_id`/`neutralization` e **reordenado para depois de `risks`** (FK)
- [x] T011 [P] Ajustar testes dependentes da 008 à nova forma: `src/__tests__/integration/shared/db/epi-constraints.test.ts`, `epi-risk-isolation.test.ts`, `epi-migration-shape.test.ts`

**Checkpoint**: schema + migration + domínio prontos — verificação por story pode começar.

---

## Phase 3: User Story 1 — Isolamento por tenant do vínculo (Priority: P1) 🎯 MVP

**Goal**: nenhum vínculo cruza tenants em leitura ou escrita; risco/EPI de outra org na criação são rejeitados.

**Independent Test**: com org_a/org_b semeados, conectado como `app_runtime` em org_a — listar não traz vínculo de org_b; criar com risco/EPI de org_b → `FK_NOT_FOUND`; editar/remover vínculo de org_b por id → `NOT_FOUND`.

- [x] T012 [US1] Implementar `assertRiskInTenant` / `assertCatalogInTenant` (barreira de isolamento pré-insert) em `src/shared/db/repositories/epi-risk.ts`
- [x] T013 [US1] Garantir todas as queries do repositório escopadas por `withOrg` + escritas por `auditedTenantWrite` em `src/shared/db/repositories/epi-risk.ts`
- [x] T014 [US1] Teste de integração de isolamento cross-tenant (list/create/update/delete de org_b inacessíveis por org_a; `FK_NOT_FOUND`; `NOT_FOUND`; `FORBIDDEN` client) em `src/__tests__/integration/pgr/epi-risk.test.ts`

**Checkpoint**: isolamento provado — o núcleo funcional pode ser exposto com segurança.

---

## Phase 4: User Story 2 — Vincular EPIs a um risco com neutralização (Priority: P1)

**Goal**: adicionar/listar/editar/remover vínculo de EPI a um risco, neutralização obrigatória, par único.

**Independent Test**: adicionar EPI com neutralização; listar (Nome/CA/neutralização); duplicar par → `DUPLICATE`; editar neutralização; remover; risco pode ficar sem EPIs.

- [x] T015 [US2] `listRiskEpis` (innerJoin `epi_catalog` p/ nome+CA+neutralização) em `src/shared/db/repositories/epi-risk.ts`
- [x] T016 [US2] `createRiskEpi` (asserts + insert; duplicado → `DUPLICATE`), `updateRiskEpiNeutralization` (null→`NOT_FOUND`), `deleteRiskEpi` em `src/shared/db/repositories/epi-risk.ts`
- [x] T017 [US2] 5 Server Actions via `officeAction` (`{ audit: true }` nas escritas, `revalidatePath`) em `src/shared/server/actions/pgr/epi-risk.ts`
- [x] T018 [US2] REST `route.ts` (GET list + POST 201) em `src/app/api/v1/risks/[id]/epis/route.ts`
- [x] T019 [US2] REST `[linkId]/route.ts` (PUT neutralização + DELETE 204) em `src/app/api/v1/risks/[id]/epis/[linkId]/route.ts`
- [x] T020 [P] [US2] Teste unit dos schemas/rótulos/obrigatoriedade em `src/__tests__/unit/domains/pgr/epi-risk.test.ts`
- [x] T021 [US2] Testes de integração add/update/remove + `DUPLICATE` + zero-EPI em `src/__tests__/integration/pgr/epi-risk.test.ts`

**Checkpoint**: vínculo utilizável ponta a ponta via API — o PGR já consegue consultar EPIs por risco.

---

## Phase 5: User Story 3 — Descoberta e gestão na tela de edição (Priority: P2)

**Goal**: buscar EPIs disponíveis por nome/CA (só não vinculados) e gerenciar o vínculo na edição do risco.

**Independent Test**: buscar "luva" → só EPIs `epi` não vinculados que casam; adicionar um → some dos disponíveis, aparece nos vinculados; tela de criação não exibe a seção.

- [x] T022 [US3] `listAvailableEpisForRisk` (catálogo `type='epi'` **menos** vinculados via `notInArray` + busca nome/CA) em `src/shared/db/repositories/epi-risk.ts`
- [x] T023 [US3] Suporte `?available=true&search=` no GET REST em `src/app/api/v1/risks/[id]/epis/route.ts`
- [x] T024 [US3] Componente `EpiRiscoSection` (client, padrão `ManageFunctions`: tabela Nome·CA·Neutraliza?·Remover + linha de adicionar) em `src/app/(protected)/risks/[id]/_components/epi-risco-section.tsx`
- [x] T025 [US3] Montar `<EpiRiscoSection riskId={risk.id} />` após `<RiskForm>` em `src/app/(protected)/risks/[id]/edit/page.tsx`
- [x] T026 [P] [US3] Teste de integração `listAvailableEpisForRisk` (exclui vinculados; filtra por nome/CA) em `src/__tests__/integration/pgr/epi-risk.test.ts`

**Checkpoint**: fluxo de gestão do vínculo completo na UI de edição do risco.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: cumprir a regra das 4 partes e fechar os gates de qualidade.

- [x] T027 [P] Registrar `/risks/{id}/epis` (verbos/filtros) nas tabelas "Recursos" e "Sumário" de `docs/api/api-design.md`
- [x] T028 [P] Adicionar pasta "EPI x risco (vinculo)" + variável `epiCatalogId` em `docs/api/sst-manager.postman_collection.json`
- [x] T029 [P] Documentar o as-built em `docs/briefings/implementacao-epi-risk-link.md`
- [x] T030 Rodar `npm run check` (format+lint+typecheck+unit) → verde
- [x] T031 Rodar `npm run build` → compila as duas rotas REST
- [ ] T032 Rodar `npm run test:integration` contra **Postgres efêmero** (`INTEGRATION_DATABASE_URL` + `INTEGRATION_APP_RUNTIME_URL`) e confirmar as suítes de `epi-risk` verdes (não `skip`)
- [ ] T033 Rodar o `quickstart.md` (§3 REST + §4 UI) ponta a ponta e marcar o mapa de aceite
- [ ] T034 **No rebase**: se o PR #136 (`0013_risk_methodology`) mesclar primeiro, renumerar esta migration para `0014` (renomear `.sql`, ajustar `tag` no `_journal.json` e `prevId` do snapshot)

---

## Dependencies & Execution Order

- **Setup (Fase 1)** → **Foundational (Fase 2)**: bloqueia todas as stories (schema+migration+domínio).
- **US1 (P1, Fase 3)**: barreira de isolamento — pré-requisito de segurança para expor US2/US3.
- **US2 (P1, Fase 4)**: núcleo funcional; depende de US1 (asserts) e da Fase 2.
- **US3 (P2, Fase 5)**: descoberta/UI; depende de US2 (mutações que a UI chama).
- **Polish (Fase 6)**: docs/Postman/gates após US1–US3.

### Parallel Opportunities

- Fase 1: T002, T003 em paralelo.
- Fase 2: T006, T009, T010, T011 em paralelo (arquivos distintos) após T004/T005.
- Fase 4: T020 (unit) paralelo à implementação; Fase 5: T026 paralelo.
- Fase 6: T027, T028, T029 em paralelo.

## Implementation Strategy

- **MVP** = Fase 1 + Fase 2 + **US1 (isolamento)** + **US2 (vínculo com neutralização)** — já entrega
  o vínculo utilizável e seguro pelo PGR via API. US3 (descoberta/UI) e Polish incrementam.
- Ordem de entrega real (as-built): schema/migration/domínio → repo+asserts → actions+REST → UI → docs+testes.

## Notes

- Todos os itens `[x]` refletem o commit `ce884a9`. Os `[ ]` restantes (T032–T034) são validação em
  ambiente com `INTEGRATION_*` e o follow-up de renumeração no rebase — não são pendências de código.
