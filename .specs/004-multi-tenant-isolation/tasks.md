---
description: "Task list — Isolamento Multi-Tenant (onboarding/troca de organização + backstop de RLS)"
---

# Tasks: Isolamento Multi-Tenant

**Input**: Design documents from `.specs/004-multi-tenant-isolation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: OBRIGATÓRIOS nesta fatia (constituição + `CLAUDE.md`). Cada story inclui
tarefas de teste, escritas antes da implementação (falhar → implementar → passar).

**Organização**: tarefas agrupadas por user story. Há duas trilhas:

- **Trilha app-layer** (contexto de tenant): US1, US2, US5, US6, US8 — dependem só do Foundational.
- **Trilha RLS** (backstop): US4 entrega a infraestrutura; US3, US7, US9 a verificam/documentam — dependem de US4.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: a qual user story a tarefa pertence (US1..US9)

## Path Conventions

Projeto único Next.js fullstack, layout `src/`; alias `@/*` → `./src/*`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: estrutura e pré-condições do ambiente

- [X] T001 Criar diretório `src/shared/tenant/` para utilitários de contexto de tenant (auditoria) conforme `plan.md`
- [X] T002 [P] Validar que o projeto `integration` do `jest.config.ts` enxerga as env de integração já documentadas no `quickstart.md` (`INTEGRATION_DATABASE_URL`, `INTEGRATION_DATABASE_URL_ADMIN`, `INTEGRATION_APP_RUNTIME_URL`) — sem as quais os testes RLS ficam `describe.skip`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: utilitários compartilhados por múltiplas stories (auditoria, papel de banco, harness de teste). NÃO contém deliverable de story.

**⚠️ CRITICAL**: nenhuma story começa antes desta fase.

- [X] T003 [P] Declarar o papel existente `app_runtime` em `src/shared/db/roles.ts` via `pgRole("app_runtime").existing()` (exportar `appRuntimeRole`) — usado pelas policies GUC
- [X] T004 [P] Implementar o logger de auditoria `logTenantEvent` em `src/shared/tenant/audit-log.ts` (espelhar `src/shared/clerk-sync/log.ts`; eventos e campos conforme `contracts/audit-events.md`)
- [X] T005 [P] Teste unitário de `logTenantEvent` (formato + ausência de PII/segredos) em `src/__tests__/unit/shared/tenant/audit-log.test.ts`
- [X] T006 Estender o helper de integração `src/__tests__/integration/_helpers/db.ts` com `withOrgTx(client, orgId, fn)` que abre transação e faz `set_config('app.current_org', $1, true)` antes do callback (suporte aos testes de RLS)

**Checkpoint**: fundação pronta — stories podem começar.

---

## Phase 3: User Story 4 - Padrão de isolamento validado em tabela de teste (Priority: P1) 🎯 MVP (rede de segurança)

**Goal**: entregar a infraestrutura de RLS pelo caminho Drizzle/`app_runtime` — `withOrg`, tabela de referência `tenant_probe`, policy `USING`/`WITH CHECK` e migration — e prová-la num teste canônico.

**Independent Test**: aplicar as migrations em Postgres efêmero e, com `app_runtime`, confirmar que `tenant_probe` existe com RLS habilitado, policy ativa, e que o teste de isolamento passa (A→só A, B→só B, sem tenant→vazio).

### Tests for User Story 4 ⚠️

- [X] T007 [P] [US4] Teste de integração (deve FALHAR primeiro) do caminho crítico de isolamento em `src/__tests__/integration/shared/db/tenant-isolation.test.ts`: com tenant A fixado, `select` sem `where` em `tenant_probe` retorna só A; com B, só B; sem tenant fixado, 0 linhas; **com um `orgId` inexistente/inválido fixado, 0 linhas** (FR-018) (gate por `INTEGRATION_APP_RUNTIME_URL`)
- [X] T008 [P] [US4] Teste unitário de `withOrg` emitindo `set_config('app.current_org', $1, true)` parametrizado dentro de transação (tx mockada) em `src/__tests__/unit/shared/db/with-org.test.ts`

### Implementation for User Story 4

- [X] T009 [P] [US4] Definir o schema `tenant_probe` (`id` uuid PK, `organization_id` text NOT NULL, `label` text, `created_at`) + índice em `organization_id` + `pgPolicy("tenant_probe_isolation", { for:"all", to: appRuntimeRole, using/withCheck: current_setting('app.current_org', true) })` + `.enableRLS()` em `src/shared/db/schema/tenant-probe.ts`
- [X] T010 [US4] Re-exportar `tenantProbe`/tipos em `src/shared/db/schema/index.ts`
- [X] T011 [US4] Implementar `withOrg(orgId, fn)` em `src/shared/db/with-org.ts` (abre `db.transaction`, executa `set_config('app.current_org', $1, true)`, roda `fn(tx)`) conforme `contracts/withorg-and-rls.md`
- [X] T012 [US4] Gerar a migration `0003_*` com `npm run db:generate` e adicionar como SQL custom `GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_probe TO app_runtime` no arquivo em `src/shared/db/migrations/`
- [X] T013 [US4] Fazer T007/T008 passarem (aplicar migration no Postgres efêmero, rodar `npm run test:integration` e `npm run test`)

**Checkpoint**: infraestrutura de RLS pronta e provada — US3/US7/US9 podem prosseguir.

---

## Phase 4: User Story 3 - Backstop de leitura: query sem filtro isola o tenant (Priority: P1)

**Goal**: garantir que uma query que esquece o filtro de organização ainda retorna só o tenant ativo, e que o escopo não vaza fora da transação.

**Independent Test**: numa transação com tenant fixado, query sem `where(organizationId)` retorna só o tenant ativo; uma query fora de `withOrg` retorna 0 linhas.

**Dependency**: requer a infraestrutura da US4 (T009–T012).

### Tests for User Story 3 ⚠️

- [X] T014 [P] [US3] Estender `src/__tests__/integration/shared/db/tenant-isolation.test.ts`: (a) `select` SEM `where(organizationId)` dentro de `withOrg(A)` retorna só A; (b) após `withOrg(A)`, uma query "bare" subsequente (sem `withOrg`) retorna 0 linhas (escopo não vaza da transação — SC-011)

### Implementation for User Story 3

- [X] T015 [US3] Adicionar exemplo de leitura org-scoped `listTenantProbes(orgId)` em `src/shared/db/repositories/tenant-probe.ts` usando `withOrg(orgId, (tx) => tx.select()...where(eq(...)))` (demonstra 1ª + 2ª barreira); cobrir com o teste de T014

**Checkpoint**: backstop de leitura comprovado.

---

## Phase 5: User Story 1 - Onboarding: criar organização (Priority: P1) 🎯 MVP (trilha app)

**Goal**: usuário sem empresa é levado ao onboarding e, ao criar uma organização, chega ao dashboard dela.

**Independent Test**: com `auth()` mockado sem `orgId`, a área autenticada redireciona para `/onboarding`; após criar org (sessão passa a ter `orgId`), chega ao dashboard.

### Tests for User Story 1 ⚠️

- [X] T016 [P] [US1] Teste unitário de detecção "usuário sem organização" e resolução do `orgId` da sessão em `src/__tests__/unit/shared/auth/require-org-context.test.ts` (criar/estender; `auth()` mockado)
- [X] T017 [P] [US1] Teste de integração (Clerk mockado) do redirect do layout protegido para `/onboarding` quando sem `orgId`, **incluindo o caso de usuário removido da org ativa** (sessão perde `orgId`) → mesmo redirect (FR-010), em `src/__tests__/integration/auth/onboarding-guard.test.tsx`

### Implementation for User Story 1

- [X] T018 [US1] Criar `src/app/(protected)/onboarding/page.tsx` com `<CreateOrganization afterCreateOrganizationUrl="/dashboard" />` conforme `contracts/onboarding-and-shell.md`
- [X] T019 [US1] Refatorar `src/app/(protected)/layout.tsx`: tratar `NoActiveOrgError`/sessão sem `orgId` com `redirect('/onboarding')` (remover o `<OrganizationList>` inline) e renderizar o shell para os filhos
- [X] T020 [US1] Validar fluxo criar-org → `/dashboard` (teste de integração com transição de sessão mockada / passo do `quickstart.md`)

**Checkpoint**: onboarding por criação funcional e testável.

---

## Phase 6: User Story 2 - Trocar a organização ativa pelo seletor (Priority: P1)

**Goal**: seletor no shell permite trocar a org ativa; 100% dos dados passam a ser da nova empresa.

**Independent Test**: com usuário de duas orgs (mock), a leitura org-scoped usa o `orgId` ativo e a tag de cache é por-org; trocar a org muda o escopo.

### Tests for User Story 2 ⚠️

- [X] T021 [P] [US2] Teste de integração (auth mockado, duas orgs) em `src/__tests__/integration/auth/org-switch.test.tsx`: leitura usa o `orgId` ativo e nenhuma chave/tag de cache cruza tenants

### Implementation for User Story 2

- [X] T022 [US2] Adicionar `<OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/dashboard" />` ao shell em `src/app/(protected)/layout.tsx` (FR-004)
- [X] T023 [US2] Emitir `tenant.org_switched` via `logTenantEvent` no **ponto de entrada pós-troca** (shell carregado após `afterSelectOrganizationUrl`), comparando o `orgId` ativo com o último observado na sessão — em `src/app/(protected)/layout.tsx` + utilitário em `src/shared/tenant/` (FR-020/SC-013)

**Checkpoint**: troca de organização funcional; isolamento de exibição garantido pelo `orgId` da sessão.

---

## Phase 7: User Story 5 - Onboarding: aceitar convite pendente (Priority: P2)

**Goal**: usuário com convite pendente aceita pelo onboarding e passa a acessar aquela empresa.

**Independent Test**: com `auth()` mockado expondo convite pendente, o onboarding apresenta o convite; aceitar torna a empresa ativa.

**Dependency**: usa a página de onboarding da US1 (T018).

### Tests for User Story 5 ⚠️

- [X] T024 [P] [US5] Teste de integração (mockado) de que convites pendentes são exibidos em `/onboarding` em `src/__tests__/integration/auth/onboarding-invite.test.tsx`

### Implementation for User Story 5

- [X] T025 [US5] Acrescentar `<OrganizationList hidePersonal afterSelectOrganizationUrl="/dashboard" />` em `src/app/(protected)/onboarding/page.tsx` para exibir/aceitar convites (FR-003)

**Checkpoint**: onboarding por convite funcional.

---

## Phase 8: User Story 6 - Persistência da organização ativa (Priority: P2)

**Goal**: a org ativa selecionada persiste entre recarregamentos e reaberturas de sessão.

**Independent Test**: com a sessão Clerk retendo `orgId` (mock), a org ativa sobrevive a reload/reabertura; a aplicação não mantém storage próprio.

### Tests for User Story 6 ⚠️

- [X] T026 [P] [US6] Teste de integração (auth mockado) em `src/__tests__/integration/auth/org-persistence.test.tsx`: a org ativa persiste após "reload" (sessão retém `orgId`) e o app não lê org de input do cliente (FR-008/SC-006)

**Checkpoint**: persistência garantida pela sessão Clerk (sem storage próprio).

---

## Phase 9: User Story 7 - Backstop de escrita: rejeição cross-tenant (Priority: P2)

**Goal**: gravar registro de outra organização (≠ ativa) é rejeitado pelo banco (`WITH CHECK`).

**Independent Test**: com tenant A fixado, `insert`/`update` com `organization_id = B` em `tenant_probe` é rejeitado.

**Dependency**: requer a infraestrutura da US4 (policy `WITH CHECK`, `withOrg`).

### Tests for User Story 7 ⚠️

- [X] T027 [P] [US7] Teste de integração de rejeição de escrita cross-tenant em `src/__tests__/integration/shared/db/tenant-write-rejection.test.ts`: dentro de `withOrg(A)`, `insert` e `update` com `organization_id = B` são rejeitados pelo banco

### Implementation for User Story 7

- [X] T028 [US7] No repositório `src/shared/db/repositories/tenant-probe.ts`, capturar a rejeição do banco e convertê-la em `Result`/erro sem vazar SQL, emitindo `tenant.cross_tenant_rejected` via `logTenantEvent` (FR-015/FR-020)

**Checkpoint**: backstop de escrita comprovado.

---

## Phase 10: User Story 8 - Bloqueio de acesso sem organização ativa (Priority: P3)

**Goal**: qualquer acesso à área autenticada sem org ativa é bloqueado/redirecionado; Server Actions/Route Handlers bloqueiam antes de tocar o banco.

**Independent Test**: com `auth()` mockado sem `orgId`, uma Server Action/Route Handler de negócio é bloqueada antes de qualquer acesso a dado e emite `tenant.access_blocked_no_org`.

### Tests for User Story 8 ⚠️

- [X] T029 [P] [US8] Teste unitário da regra de bloqueio (sem `orgId` → bloqueia) em `src/__tests__/unit/shared/auth/require-org-context.test.ts` (estender)
- [X] T030 [P] [US8] Teste de integração (mock sem org) de que uma Server Action / Route Handler de negócio é bloqueada antes do acesso ao banco em `src/__tests__/integration/auth/no-org-block.test.ts`

### Implementation for User Story 8

- [X] T031 [US8] Garantir que as entradas de negócio chamem `requireOrgContext()` no topo e emitam `tenant.access_blocked_no_org` no caminho de bloqueio; aplicar/demonstrar no handler de exemplo (`src/shared/server/actions/me.ts` e/ou `src/app/api/me`) conforme `contracts/onboarding-and-shell.md`

**Checkpoint**: invariante "sem tenant, sem dado" garantida em todos os caminhos.

---

## Phase 11: User Story 9 - Padrão de RLS documentado para revisão (Priority: P3)

**Goal**: o padrão (policy `USING`/`WITH CHECK` + `withOrg`/`orgScopedDb`) é descobrível e citável por revisores na modelagem de cada módulo.

**Independent Test**: a partir da doc de arquitetura, um revisor encontra o exemplo canônico (`tenant_probe` + `withOrg`) e o contrato replicável.

**Dependency**: requer US4 (exemplo canônico existente).

### Implementation for User Story 9

- [X] T032 [US9] Acrescentar, na doc existente `docs/architecture/02-modelagem-de-dados.md` (seção RLS) e/ou `docs/architecture/03-api-design.md`, um ponteiro para o exemplo canônico `tenant_probe` e o contrato `contracts/withorg-and-rls.md`, exigindo o padrão em novos módulos (editar arquivos existentes — não criar novos)

**Checkpoint**: padrão documentado e exigível em revisão.

---

## Phase 12: Polish & Cross-Cutting Concerns

- [X] T033 [P] Rodar o quality gate completo: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration` (todos verdes); confirmar que a garantia de papel restrito permanece válida — `app_runtime` conecta sem `BYPASSRLS` (re-rodar `src/__tests__/integration/shared/db/least-privilege.test.ts`, FR-017)
- [X] T034 [P] Validar `quickstart.md` ponta a ponta (aplicar migration + testes RLS no Postgres efêmero)
- [X] T035 Limpeza: sem `any`, nomes intencionais, sem código morto; revisar logs (zero PII/segredos)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup — BLOQUEIA todas as stories.
- **US4 (Phase 3)**: depende do Foundational — entrega a infra de RLS.
- **US3 (Phase 4)**, **US7 (Phase 9)**, **US9 (Phase 11)**: dependem de **US4**.
- **US1 (Phase 5)**, **US2 (Phase 6)**, **US6 (Phase 8)**, **US8 (Phase 10)**: dependem só do Foundational (trilha app).
- **US5 (Phase 7)**: depende da página de onboarding da **US1**.
- **Polish (Phase 12)**: depende das stories desejadas concluídas.

### User Story Dependencies

```
Foundational ─┬─▶ US4 ─┬─▶ US3
              │        ├─▶ US7
              │        └─▶ US9
              ├─▶ US1 ─▶ US5
              ├─▶ US2
              ├─▶ US6
              └─▶ US8
```

### Within Each User Story

- Testes escritos e FALHANDO antes da implementação (constituição).
- Schema antes de helper/migration; helper antes do uso em repositório.
- Implementação antes de integração; story completa antes da próxima prioridade.

### Parallel Opportunities

- Setup: T002 [P].
- Foundational: T003, T004, T005 [P] (T006 toca o helper de teste — sequencial em relação a quem o usa).
- As duas trilhas (app: US1/US2/US6/US8; RLS: US4→US3/US7/US9) podem ser tocadas em paralelo por pessoas diferentes após o Foundational.
- Dentro de uma story, tarefas [P] em arquivos distintos rodam juntas.

---

## Parallel Example: Foundational

```bash
# Após o Setup, em paralelo:
Task: "T003 Declarar appRuntimeRole em src/shared/db/roles.ts"
Task: "T004 Implementar logTenantEvent em src/shared/tenant/audit-log.ts"
Task: "T005 Teste unitário de logTenantEvent"
```

## Parallel Example: US4 (infra de RLS)

```bash
# Testes primeiro (devem falhar):
Task: "T007 Teste de isolamento canônico (tenant-isolation.test.ts)"
Task: "T008 Teste unitário de withOrg (set_config parametrizado)"

# Depois, schema isolado pode iniciar enquanto o teste existe:
Task: "T009 Schema tenant_probe + pgPolicy GUC"
```

---

## Implementation Strategy

### MVP First

A fatia tem dois âncoras P1 complementares (defesa em profundidade):

1. Phase 1–2 (Setup + Foundational).
2. **US4** (Phase 3) — a rede de segurança (RLS + tabela de demonstração).
3. **US1** (Phase 5) — a porta de entrada do usuário (onboarding/criar org).
4. **STOP & VALIDATE**: com US4 + US1, há onboarding funcional **e** backstop provado — o MVP da fatia.

### Incremental Delivery

US4 → US3 (read backstop) → US1 → US2 (switcher) → US5 (convite) → US6 (persistência)
→ US7 (write backstop) → US8 (guard transversal) → US9 (doc). Cada story agrega valor
sem quebrar as anteriores.

---

## Notes

- Testes são OBRIGATÓRIOS (constituição/`CLAUDE.md`): unitários (lógica/sessão, `auth()` mockado), integração app-layer (mock de sessão, sem DB) e integração RLS (Postgres efêmero, nunca SQLite).
- O caminho crítico de isolamento (US3/US4) e a rejeição cross-tenant (US7) são escritos/validados à mão.
- `[Story]` mapeia a tarefa à story para rastreabilidade.
- Commit após cada tarefa ou grupo lógico (sem `git push` automático).
- Evitar: conflito no mesmo arquivo entre tarefas [P]; dependências cross-story que quebrem a independência declarada.

## Execution notes (implement 2026-06-17)

- Quality gate verde: `npm run lint`, `npm run typecheck`, `npm run test` (49/49) e
  `npm run test:integration` (49 passaram; suítes de RLS em `describe.skip`).
- **RLS contra Postgres real não foi executado neste ambiente**: as suítes
  `tenant-isolation`, `tenant-write-rejection` e `least-privilege` são gated por
  `INTEGRATION_APP_RUNTIME_URL`/`INTEGRATION_DATABASE_URL` (Postgres efêmero), não
  provisionados aqui — ficam `skip` (mesmo padrão pré-existente). Estão escritas e
  type-checadas; precisam rodar no CI com o branch efêmero do Supabase (T013/T034).
- `npm run db:generate` gerou `0003_numerous_king_bedlam.sql` (tabela + RLS + policy
  GUC `TO app_runtime`); o `GRANT ... TO app_runtime` foi adicionado como SQL custom.
- Desvio menor: a detecção determinística de troca de organização (T023) foi
  cabeada no middleware (`src/proxy.ts`) — e não no render do layout — porque um
  Server Component não pode escrever cookies; a lógica pura fica em
  `src/shared/tenant/org-switch.ts` (`reconcileActiveOrg`).
