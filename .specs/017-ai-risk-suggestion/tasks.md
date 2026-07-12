---
description: "Task list — Sugestão de riscos assistida por IA"
---

# Tasks: Sugestão de riscos assistida por IA

**Input**: Design documents from `.specs/017-ai-risk-suggestion/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: incluídos (política de testes é MUST na constituição — unit + integração).

> **Estado: as-built.** Esta fatia já foi implementada no branch `feature/ai-risk-suggestion`. Tarefas
> já concluídas estão marcadas `[X]` (arquivos existem e os gates passam — ver
> [quickstart.md](./quickstart.md) §1). Permanecem `[ ]` apenas os **follow-ups** reais (validação com
> chave real do LLM, integração em Postgres efêmero real, renumeração de migration no rebase). A emenda
> da constituição (T035) já foi escrita. Um `/speckit-implement` aqui é, na prática, um passe de
> verificação.

**Format**: `[ID] [P?] [Story?] Descrição com caminho`

## Phase 1: Setup (infra compartilhada)

- [x] T001 Adicionar dependência `@anthropic-ai/sdk` em `package.json` (+ `package-lock.json`)
- [x] T002 [P] Registrar `ANTHROPIC_API_KEY` e `AI_SUGGESTION_MODEL` em `.env.example`

---

## Phase 2: Foundational (pré-requisitos bloqueantes)

**⚠️ Bloqueia US1** (US2 depende só de T009).

- [x] T003 Criar schema `src/shared/db/schema/ai-usage-events.ts` (org_id FK cascade, kind, created_at, 2 índices, RLS `ai_usage_events_isolation`)
- [x] T004 Exportar `aiUsageEvents` em `src/shared/db/schema/index.ts`
- [x] T005 Gerar/editar migration `src/shared/db/migrations/0014_ai_usage_events.sql` (CREATE TABLE + ENABLE RLS + FK + índices + POLICY + `GRANT SELECT, INSERT`); validar `db:generate` → "No schema changes"
- [x] T006 [P] Criar erro `src/shared/errors/ai-unavailable-error.ts` (`AI_UNAVAILABLE`, 502)
- [x] T007 [P] Mapear `AI_UNAVAILABLE: 502` em `src/shared/api/rest.ts`
- [x] T008 [P] Estender `src/shared/tenant/plan.ts` com `FREE_AI_SUGGESTION_MONTHLY_QUOTA = 20` e `isAiSuggestionAvailable(plan, count)`
- [x] T009 [P] Criar `src/shared/integrations/ai/config.ts` (server-only: `getAiModel()`, `requireAnthropicApiKey()`)

**Checkpoint**: fundação pronta.

---

## Phase 3: User Story 1 — Sugerir e revisar riscos por IA (P1) 🎯 MVP

**Goal**: botão no GES gera sugestões estruturadas por IA (contexto não-PII), revisão/seleção e aceite como rascunho em `risks`.

**Independent Test**: acionar "Sugerir Riscos com IA" num GES bem descrito, selecionar itens, confirmar e ver só os selecionados como rascunho; nada é adicionado sem seleção.

### Tests for User Story 1

- [x] T010 [P] [US1] Unit domínio `src/__tests__/unit/domains/pgr/ai-risk-suggestion.test.ts` (schema/`parseModelSuggestions`/`toRiskValuesFromSuggestion`)
- [x] T011 [P] [US1] Unit prompt `src/__tests__/unit/integrations/ai/prompt.test.ts` (`buildRiskSuggestionPrompt` **sem PII**, `extractSuggestionsFromContent`, tool)
- [x] T012 [P] [US1] Unit cota `src/__tests__/unit/shared/tenant/ai-quota.test.ts` (`isAiSuggestionAvailable`)
- [x] T013 [US1] Integração `src/__tests__/integration/pgr/ai-risk-suggestion.test.ts` (Postgres efêmero, **LLM mockado**: suggest happy/cross-tenant/cota/pro/FORBIDDEN + accept happy/cross-tenant/VALIDATION)

### Implementation for User Story 1

- [x] T014 [P] [US1] Domínio `src/shared/domains/pgr/ai-risk-suggestion.ts` (`suggestedRiskSchema`, `parseModelSuggestions`, `toRiskValuesFromSuggestion`, `AI_RISK_SUGGESTION_KIND`, `MAX_SUGGESTIONS`)
- [x] T015 [P] [US1] Prompt puro `src/shared/integrations/ai/prompt.ts` (`buildRiskSuggestionPrompt` só campos do GES, `buildSuggestionTool`, `extractSuggestionsFromContent`)
- [x] T016 [US1] Integração de rede `src/shared/integrations/ai/anthropic.ts` (server-only: `requestRiskSuggestions`, `tool_choice` forçado, falha → `AiUnavailableError`)
- [x] T017 [US1] Repositório `src/shared/db/repositories/ai-risk-suggestion.ts` (`fetchGesRiskContext` sem `employees`, `countAiUsageInCurrentMonth`, `recordAiUsage`)
- [x] T018 [US1] Núcleo compartilhado `src/shared/server/pgr/ai-risk-suggestion-core.ts` (`runSuggestRisks`: GES→cota→LLM→registra; `runAcceptSuggestedRisks`)
- [x] T019 [US1] Server Actions `src/shared/server/actions/pgr/ai-risk-suggestion.ts` (`suggestRisks`/`acceptSuggestedRisks` em `officeAction`, audit)
- [x] T020 [P] [US1] REST `src/app/api/v1/ges/[id]/risk-suggestions/route.ts` (POST suggest, 200)
- [x] T021 [P] [US1] REST `src/app/api/v1/ges/[id]/risk-suggestions/accept/route.ts` (POST accept, 201)
- [x] T022 [US1] UI `src/app/(protected)/ges/[id]/_components/suggest-risks-section.tsx` (botão + modal de revisão: checkbox, loading, empty/erro)
- [x] T023 [US1] Montar a seção em `src/app/(protected)/ges/[id]/edit/page.tsx`
- [x] T024 [P] [US1] Docs REST em `docs/api/api-design.md` (tabelas Recursos + Sumário)
- [x] T025 [P] [US1] Postman: pasta "Sugestao de riscos (IA)" em `docs/api/sst-manager.postman_collection.json`

**Checkpoint**: US1 funcional e testável isoladamente (MVP).

---

## Phase 4: User Story 2 — Dicas de preenchimento (P2)

**Goal**: dicas estáticas NR-01 nos campos críticos de GES e risco.

**Independent Test**: abrir os formulários de GES e de risco e ver as dicas nos campos, sem chamada externa.

### Implementation for User Story 2

- [x] T026 [P] [US2] Constantes `src/shared/domains/pgr/field-hints.ts` (`GES_FIELD_HINTS`/`RISK_FIELD_HINTS`)
- [x] T027 [P] [US2] Componente `src/app/(protected)/_ui/field-hint.tsx` (`FieldHint`)
- [x] T028 [US2] Ligar dicas em `src/app/(protected)/ges/_components/ges-form.tsx` (processo/ambiente)
- [x] T029 [US2] Ligar dica em `src/app/(protected)/ges/[id]/_components/manage-functions.tsx` (funções)
- [x] T030 [US2] Ligar dicas em `src/app/(protected)/risks/_components/risk-form.tsx` (fontes/propagação/lesões)

**Checkpoint**: US1 e US2 funcionam independentemente.

---

## Phase 5: Polish & Cross-Cutting

- [x] T031 Gates: `typecheck` ✅ · `lint` ✅ · `test` ✅ (447/447) · `build` ✅ · `db:generate` "No schema changes" ✅
- [x] T032 Documentação as-built `docs/briefings/implementacao-ai-risk-suggestion.md`
- [ ] T033 Rodar `npm run test:integration` contra Postgres efêmero real (`INTEGRATION_*`) — suíte fica `skip` sem env
- [ ] T034 Validar happy path do LLM ponta a ponta com `ANTHROPIC_API_KEY` real (rede coberta por mock nos testes)
- [x] T035 **Emenda da constituição (Princípio II)**: emenda **1.3.0** (2026-07-08) autoriza provedores de LLM como infra permitida sob salvaguardas — `.specify/memory/constitution.md` (Princípio II + stack + footer + sync report). Pendente apenas de commit.
- [x] T036 **Renumerar migration `0014` → `0015`** — colidiu com `0014_epi_risk_link` do develop; regenerada como `0015_ai_usage_events` via `db:generate` sobre o schema atualizado (GRANT customizado preservado; `_journal.json`/snapshot reencadeados), `db:generate` "No schema changes" ✅

---

## Dependencies & Execution Order

- **Setup (T001–T002)**: sem dependências.
- **Foundational (T003–T009)**: depende do Setup; **bloqueia US1**. US2 depende só de T027 (componente) + T026.
- **US1 (T010–T025)**: depende da fundação. Testes antes da implementação (TDD).
- **US2 (T026–T030)**: independente da US1 (só compartilha o padrão de UI). Pode ir em paralelo.
- **Polish (T031–T036)**: após US1/US2.

### Parallel Opportunities

- T006/T007/T008/T009 [P] (arquivos distintos).
- Testes de US1 T010/T011/T012 [P]; rotas REST T020/T021 [P]; docs T024/T025 [P].
- Domínio/prompt T014/T015 [P]. US2 T026/T027 [P].

---

## Implementation Strategy

- **MVP** = Setup + Foundational + US1 (T001–T025): entrega a sugestão por IA ponta a ponta.
- **Incremento** = US2 (dicas) — valor adicional sem tocar a US1.
- **Follow-ups** (T033–T036) são condições de fechamento/rebase e a **emenda da constituição** (gate do Princípio II), não bloqueiam a demonstração das histórias.

## Notes

- 34 de 36 tarefas concluídas; 2 follow-ups abertos (T033, T034).
- Contagem por história: Setup 2 · Foundational 7 · US1 16 · US2 5 · Polish 6.
- T035 (emenda da constituição 1.3.0) **resolvido** — gate CRÍTICO do `/speckit-analyze` (D1) fechado.
- T036 (renumeração de migration) **resolvido** no merge com o develop: `0014` → `0015_ai_usage_events`.
  Restam apenas: T033 (integração em Postgres efêmero real) e T034 (validação com chave real do LLM),
  ambos dependentes de ambiente/segredo externos.
