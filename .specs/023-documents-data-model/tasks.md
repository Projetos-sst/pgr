# Tasks: Modelo de dados — Documentos, Pastas e Jobs

**Input**: Design documents from `.specs/023-documents-data-model/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/schema-and-migrations.md, quickstart.md

**Tests**: INCLUÍDOS — obrigatórios pela constituição (§Quality Gates) e pelos SC-001..005 do spec. Integração contra **Postgres efêmero** (`INTEGRATION_*`), nunca SQLite.

**Organization**: fatia de modelagem pura — o schema + migration são UM artefato (migration única `0025`), por isso ficam na fase Foundational; cada user story entrega seus invariantes verificados por testes de forma independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (acervo/pastas/validade), US2 (fila de jobs), US3 (vínculo polimórfico)

## Path Conventions

Projeto único Next.js: código em `src/`, testes em `src/__tests__/` (unit jsdom, integration node) — conforme plan.md §Project Structure.

---

## Phase 1: Setup

**Purpose**: garantir baseline verde e premissas do plano antes de tocar o schema

- [x] T001 Confirmar baseline: `npm run check` verde na branch `feature/documents-data-model`; última migration era `0023_schedule_events.sql` na execução; pós-rebase o develop trouxe a `0024_phase_06_safety_workflows` e a nova saiu como `0025`; tabelas `folders`/`documents`/`jobs` ausentes de `src/shared/db/schema/index.ts`
- [x] T002 Confirmar harness de integração: `npm run test:integration` roda contra o Postgres efêmero (`INTEGRATION_DATABASE_URL`) e o helper `src/__tests__/integration/_helpers/db.ts` aplica migrations por `--> statement-breakpoint`; conferir `SELECT version()` no Postgres efêmero (e no de produção) → **≥15**, pré-requisito do `UNIQUE ... NULLS NOT DISTINCT` (fallback: índices parciais, research §3); identificar o seed de orgs A/B existente para reuso nos testes de isolamento

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema Drizzle completo + migration `0025` — bloqueia TODAS as user stories (as 3 tabelas nascem na mesma migration)

**⚠️ CRITICAL**: nenhuma user story pode começar antes desta fase

- [x] T003 [P] Criar `src/shared/db/schema/documents.ts` com enum `document_status` (`generating|ready`), tabela `folders` (colunas/FKs/`UNIQUE (org_id, parent_id, name)` **NULLS NOT DISTINCT**/índices) e tabela `documents` (colunas incl. `document_group_id`, `doc_type` texto, `version` CHECK `>=1`, `status` default `ready`, `storage_path`, `size_bytes` bigint `mode:"number"` CHECK `>=0`, `valid_until date`, `related_entity_type/related_entity_id` + CHECK completo-ou-vazio, `UNIQUE (org_id, document_group_id, version)`, índice parcial do vínculo, `idx_documents_org_group`), tudo com `pgPolicy(...).enableRLS()` no template `src/shared/db/schema/companies.ts` e ON DELETE conforme data-model.md §Relações
- [x] T004 [P] Criar `src/shared/db/schema/jobs.ts` com enums `job_type` (`pdf_batch`) e `job_status` (`pending|processing|done|failed`), tabela `jobs` (payload jsonb NOT NULL default `'{}'`, result jsonb, attempts CHECK `>=0`, locked_at, `idx_jobs_status_created_at`) + `pgPolicy(...).enableRLS()` idem
- [x] T005 Exportar tabelas/enums/tipos novos em `src/shared/db/schema/index.ts` (depende de T003, T004)
- [x] T006 Gerar a migration: `npm run db:generate` → `src/shared/db/migrations/0025_documents_data_model.sql` (renomear o sufixo se o drizzle-kit sortear outro nome); conferir contra o checklist do contrato §1 (3 enums, 3 tabelas, ENABLE RLS, FKs/ON DELETE, UNIQUEs, índices, 3 policies)
- [x] T007 Apendar o SQL custom na `0025`: `GRANT SELECT, INSERT, UPDATE, DELETE` ao `app_runtime` (3 tabelas) + triggers `set_updated_at_<tabela>` com `DROP TRIGGER IF EXISTS` (padrão `0023_schedule_events.sql`), separados por `--> statement-breakpoint`
- [x] T008 Smoke da migration: **executar de verdade** uma suíte de integração curta já existente (ex.: `npx jest --selectProjects integration src/__tests__/integration/platform` ou a suíte do `tenant_probe`) para provar que o harness aplica a `0025` num banco limpo sem erro — não usar `--listTests` (só lista, não aplica migration)

**Checkpoint**: schema migrado — user stories podem começar (em paralelo, arquivos distintos)

---

## Phase 3: User Story 1 — Acervo de documentos com pastas e validade (Priority: P1) 🎯 MVP

**Goal**: modelo de `folders`/`documents` provado: isolamento por tenant, hierarquia com raiz, unicidade de irmãs, RESTRICT de pasta não-vazia, versão por grupo e validade derivada na leitura

**Independent Test**: quickstart §4 — suítes `validity`, `folders-model`, `documents-model`, `documents-isolation` verdes num banco limpo, sem depender de US2/US3

- [x] T009 [P] [US1] Criar `src/shared/domains/documents/validity.ts`: `classifyDocumentValidity(validUntil, { today, dueWindowDays })` → `"ok" | "due_soon" | "expired" | "no_expiry"` (contrato §3 — espelho de `classifyTrainingStatus` da 017; comparação lexicográfica de date ISO; `todayInSaoPaulo` de `src/shared/dates.ts`). **Promover** `DUE_WINDOW_DAYS_OPTIONS`/`DueWindowDays` de `src/shared/domains/pgr/trainings.ts` para `src/shared/dates.ts` com re-export em `trainings.ts` (compat) — sem import cross-domain `documents → pgr` (mesmo precedente da promoção de `todayInSaoPaulo` na 017)
- [x] T010 [P] [US1] Testes unitários em `src/__tests__/unit/domains/documents/validity.test.ts`: sem validade (`no_expiry`); vencido ontem; vence hoje → NÃO vencido (inclusivo); dentro/fora da janela; borda exata da janela (datas fixas, sem relógio real)
- [x] T011 [P] [US1] Teste de integração `src/__tests__/integration/shared/db/folders-model.test.ts`: cadeia Raiz→Contratos→2026 sobe até a raiz; irmã duplicada rejeitada (23505) — inclusive DUAS PASTAS RAIZ de mesmo nome na mesma org (NULLS NOT DISTINCT); mesmo nome em orgs distintas aceito; DELETE de pasta com subpasta E de pasta com documento → RESTRICT (23001 no PG≥18, 23503 em versões anteriores)
- [x] T012 [P] [US1] Teste de integração `src/__tests__/integration/shared/db/documents-model.test.ts`: documento válido com/sem pasta e sem validade; `UNIQUE (org_id, document_group_id, version)` violado na mesma org e aceito em orgs distintas; CHECKs `version >= 1` e `size_bytes >= 0`; `size_bytes` acima de 2^31 aceito; versão corrente derivável por `MAX(version)` do grupo
- [x] T013 [US1] Teste de integração `src/__tests__/integration/shared/db/documents-isolation.test.ts` (padrão `tenant_probe`) cobrindo `folders` e `documents`: leitura como `app_runtime` sem `app.current_org` → 0 linhas; com org A → só A; INSERT/UPDATE marcado para B com GUC=A → rejeitado pelo `WITH CHECK` (depende de T011/T012 para reusar o seed montado)

**Checkpoint**: US1 completa — SC-001 (parcial: folders/documents), SC-002 e SC-004 provados

---

## Phase 4: User Story 2 — Fila de jobs com retry e claim seguro (Priority: P1)

**Goal**: modelo de `jobs` provado: claim atômico (1 vencedor), recuperação de claim travado, attempts/result registrados, isolamento por tenant

**Independent Test**: quickstart §4 — suíte `jobs-claim` verde num banco limpo, sem depender de US1/US3

- [x] T014 [P] [US2] Teste de integração `src/__tests__/integration/shared/db/jobs-claim.test.ts` — claim concorrente: inserir 1 job `pending`; abrir DUAS transações paralelas (conexão admin do harness) executando o SQL de claim do contrato §2 (`FOR UPDATE SKIP LOCKED`); exatamente uma obtém a linha, a outra recebe 0 linhas; `attempts` do vencedor = 1 e `locked_at` preenchido
- [x] T015 [P] [US2] Na mesma suíte `jobs-claim.test.ts` — recuperação e falha: job `processing` com `locked_at` antigo volta a `pending`/`locked_at NULL` pela query de recuperação do contrato §2 (e job recente NÃO volta); transição `processing → failed` com erro estruturado em `result`; default `payload = '{}'` e CHECK `attempts >= 0`
- [x] T016 [US2] Estender `src/__tests__/integration/shared/db/documents-isolation.test.ts` com o bloco de `jobs`: leitura `app_runtime` sem GUC → vazio; com org A → só jobs de A; escrita marcada para B → rejeitada — provando que a leitura administrativa do worker (fora do `app_runtime`, decisão research §6) não tem atalho pelo runtime (depende de T013)

**Checkpoint**: US2 completa — SC-001 (3 tabelas) e SC-003 provados

---

## Phase 5: User Story 3 — Vínculo de documento a outras entidades (Priority: P2)

**Goal**: vínculo polimórfico sem FK provado: completo-ou-vazio no banco, consulta eficiente por (tipo, id), conjunto fechado na aplicação

**Independent Test**: casos de vínculo verdes isoladamente (só precisam da Phase 2)

- [x] T017 [P] [US3] Adicionar `documentRelatedEntityTypeSchema = z.enum(["pgr"])` + tipo inferido em `src/shared/domains/documents/validity.ts` (contrato §3) e teste unitário em `src/__tests__/unit/domains/documents/validity.test.ts`: aceita `"pgr"`, rejeita tipo desconhecido
- [x] T018 [US3] Estender `src/__tests__/integration/shared/db/documents-model.test.ts` com o bloco de vínculo: documento sem vínculo OK (ambos NULL); vínculo completo persistido e consultável por `(org_id, related_entity_type, related_entity_id)`; vínculo pela metade (só tipo OU só id) → rejeitado pelo CHECK; documento permanece após "sumiço" da entidade vinculada (sem FK — nada a cascatear) (depende de T012)

**Checkpoint**: US3 completa — todos os acceptance scenarios do spec provados

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: gates finais e consistência documental

- [x] T019 Rodar a validação completa do quickstart: `npm run check` + `npm run test` + `npm run test:integration` verdes (SC-005); conferir o mapa teste→critério do quickstart §4
- [x] T020 [P] Revisar invariantes documentados: data-model.md §Invariantes ainda bate com o código final (ciclo de pastas, geração do `document_group_id`, conjunto fechado, escrita `withOrg` do worker); ajustar os .md da fatia se algo divergiu na implementação
- [x] T021 [P] Higiene de workspace: nenhum arquivo temporário/console.log sobrando; `git status` limpo além do esperado; migration `0025` é a ÚNICA nova em `src/shared/db/migrations/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depende da Phase 1 — **BLOQUEIA todas as user stories** (migration única)
- **US1/US2/US3 (Phases 3–5)**: dependem só da Phase 2; independentes entre si, com duas exceções de ARQUIVO (não de story): T016 estende o arquivo criado em T013; T018 estende o arquivo criado em T012
- **Polish (Phase 6)**: depende das stories desejadas completas

### Within Phases

- T003 ∥ T004 → T005 → T006 → T007 → T008 (cadeia da migration)
- US1: T009 ∥ T010 ∥ T011 ∥ T012 → T013
- US2: T014 ∥ T015 → T016 (T016 após T013 por compartilhar arquivo)
- US3: T017 ∥ (T018 após T012 por compartilhar arquivo)

### Parallel Opportunities

- T003 ∥ T004 (schemas em arquivos distintos)
- Após T008: US1, US2 e US3 podem andar em paralelo (times distintos), respeitando as 2 dependências de arquivo acima
- Dentro da US1: T009, T010, T011, T012 todos em paralelo (4 arquivos distintos)
- T020 ∥ T021 no polish

---

## Parallel Example: User Story 1

```bash
# Após o checkpoint da Phase 2, lançar juntos:
Task: "T009 classifyDocumentValidity em src/shared/domains/documents/validity.ts"
Task: "T010 unit tests em src/__tests__/unit/domains/documents/validity.test.ts"
Task: "T011 folders-model.test.ts (hierarquia/unicidade/RESTRICT)"
Task: "T012 documents-model.test.ts (grupo/versão/CHECKs)"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (baseline) → Phase 2 (schema + migration `0025` — o coração da fatia)
2. Phase 3 (US1) → **STOP e validar**: quickstart §4 para US1
3. US1 verde = fundação do trilho GED (#34/#35) demonstrável

### Incremental Delivery

1. Phase 2 pronta → cada story adiciona provas sem quebrar as anteriores
2. US1 (acervo) → US2 (fila) → US3 (vínculo) — ordem de prioridade do spec
3. Phase 6 fecha os gates (SC-005) antes do PR

---

## Notes

- Constituição: banco é fonte de verdade — os testes provam as CONSTRAINTS, não lógica de app inexistente (FR-014: sem repositório de CRUD nesta fatia)
- O claim de job nos testes usa a conexão **admin do harness** (o worker real é da #39); nunca criar policy extra para isso
- Commits em inglês, sem qualquer linha de co-autoria
- Cada tarefa concluída = commit incremental; parar em qualquer checkpoint deixa a fatia demonstrável
