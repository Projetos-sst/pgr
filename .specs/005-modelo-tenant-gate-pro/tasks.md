# Tasks: Modelo de tenant multiempresa + fundação de Equipe e Acessos com Gate PRO

**Input**: Design documents from `.specs/005-modelo-tenant-gate-pro/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (todos presentes)

**Tests**: INCLUÍDOS e obrigatórios — a constituição (Quality Gate) e o `CLAUDE.md` exigem
unitários de regra de negócio + integração de Server Actions/handlers + caminho crítico de
isolamento (RLS) contra **Postgres efêmero**. Casos críticos multi-tenant são escritos à mão.

**Organization**: Tarefas agrupadas por user story para implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: a qual user story a tarefa pertence (US1–US6)
- Todo caminho de arquivo é relativo à raiz do repositório

## Path Conventions

Projeto único Next.js fullstack, layout `src/` (alias `@/*` → `./src/*`). Schema/repos/migrations
em `src/shared/db/`; lógica de tenant em `src/shared/tenant/`; resolução de contexto em
`src/shared/auth/`; testes em `src/__tests__/{unit,integration}/…` (espelhando os da `004`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Garantir baseline e harness antes de tocar schema.

- [x] T001 Confirmar baseline na branch `feature/modelo-tenant-gate-pro`: rodar `npm run lint`, `npx tsc --noEmit` e `npm run test:integration` (smoke + `tenant-isolation`) verdes com o harness de **Postgres efêmero** da `004` (`INTEGRATION_DATABASE_URL` / `INTEGRATION_APP_RUNTIME_URL` / `INTEGRATION_DATABASE_URL_ADMIN`); sem esses envs os `describe` de RLS ficam `skip` — registrar o estado.

**Checkpoint**: Ambiente validado; isolamento herdado da `004` provado verde.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, migration e mapeamento de repositório que **toda** user story consome.

**⚠️ CRITICAL**: Nenhuma user story começa antes desta fase concluída (schema + migration aplicada).

- [x] T002 [US1/US3] Em `src/shared/db/schema/orgs.ts`: adicionar `plan text NOT NULL DEFAULT 'free'` com `check("orgs_plan_check", sql\`${table.plan} in ('free','pro')\`)`e`clerk_org_id text`com`uniqueIndex("orgs_clerk_org_id_unique")`(nullable). Manter`orgs.id text`PK e a policy core`orgs_select_active_org` intactas. (contract: tenant-model-and-migrations §1)
- [x] T003 [P] [US2] Criar `src/shared/db/schema/companies.ts`: `pgTable("companies", …)` com `id uuid PK defaultRandom`, `org_id text NOT NULL` FK→`orgs.id` `onDelete cascade`, `cnpj text`, `razao_social text`, `created_at timestamptz NOT NULL defaultNow`; `index("idx_companies_org_id")`, `uniqueIndex("uq_companies_org_id_cnpj").on(org_id, cnpj)`, `pgPolicy("companies_isolation", { for:"all", to: appRuntimeRole, using/withCheck: sql\`org_id = current_setting('app.current_org', true)\` })`, `.enableRLS()`. Espelhar `tenant-probe.ts`. (contract §3)
- [x] T004 [US5] Em `src/shared/db/schema/org-memberships.ts`: adicionar `scoped_company_id uuid` nullable, FK→`companies.id` `onDelete cascade` (importa de `./companies`). `role` permanece `text` sem CHECK nesta fatia. (contract §2; **depende de T003**)
- [x] T005 Em `src/shared/db/schema/index.ts`: exportar `companies`. (depende de T003)
- [ ] T006 Gerar migration `0004_*` com `npx drizzle-kit generate`; **editar** o SQL para (a) garantir ordem `CREATE TABLE companies` ANTES do `ALTER org_memberships ADD scoped_company_id` FK, e (b) acrescentar `GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO app_runtime;` após o `CREATE POLICY` (drizzle-kit não gera GRANT — padrão do `0003`). Aplicar com `npx drizzle-kit migrate` (conexão direta/owner `DATABASE_URL_UNPOOLED`). Arquivo em `src/shared/db/migrations/`. (contract §4; depende de T002–T005) — ⚠️ **PENDENTE (manual)**: SQL gerado e editado em `0004_modelo_tenant_gate_pro.sql` (ordem OK + GRANT custom); aplicação ao banco hospedado **bloqueada pelo guardrail** (mutação de DB compartilhado não autorizada por `/speckit-implement`) — rodar `npm run db:migrate` localmente.
- [x] T007 [P] [US3] Em `src/shared/db/repositories/orgs.ts`: incluir `plan` e `clerk_org_id` em `toOrgColumns`/`mapOrg` (round-trip dos novos campos). (depende de T002)
- [x] T008 [P] [US5] Em `src/shared/db/repositories/org-memberships.ts`: incluir `scoped_company_id` no mapeamento read/write. (depende de T004)
- [x] T009 [P] [US1] Em `src/shared/auth/errors.ts`: adicionar `NoTenantContextError` (bloqueio quando 0 memberships após self-heal), seguindo o contrato de erro existente (`NoActiveOrgError`).

**Checkpoint**: Schema novo migrado e mapeado; foundation pronta — user stories podem iniciar.

---

## Phase 3: User Story 1 — Workspace próprio no cadastro (Priority: P1) 🎯 MVP

**Goal**: Todo usuário recém-cadastrado recebe um tenant próprio (`orgs`, `plan='free'`, papel
`owner`) e chega à área autenticada operando nesse tenant, sem onboarding nem escolha de org —
inclusive contas free (sem Clerk Org). (FR-001/002/003/004; SC-001)

**Independent Test**: `user.created` cria exatamente 1 `orgs` + 1 membership `owner`; reenvio é
no-op; usuário que acessa sem tenant é auto-provisionado e segue para a área autenticada.

### Tests for User Story 1 ⚠️ (escrever ANTES; devem falhar)

- [x] T010 [P] [US1] Unit `src/__tests__/unit/shared/tenant/provision-personal-tenant.test.ts`: idempotência (2ª chamada → `created:false`, sem 2º tenant), papel `owner`, `plan='free'`, `clerk_org_id=null`, log `tenant.provisioned` só na criação e sem PII. (contract: tenant-provisioning)
- [x] T011 [P] [US1] Unit `src/__tests__/unit/shared/tenant/active-tenant.test.ts`: resolução do tenant ativo — 1 membership → esse `tenantId`; 0 → chama provisionamento (self-heal) e re-resolve; tenant **nunca** derivado de body/query/header (input do cliente ignorado). (contract: tenant-context-resolution)
- [x] T012 [P] [US1] Integração (SQLite) `src/__tests__/integration/webhooks/clerk-user-provisioning.test.ts`: `user.created` provisiona tenant + owner (idempotente em reentrega); `user.updated` não provisiona; **payload inválido → 400 e nenhum provisionamento** (assegura FR-025: validação por schema antes da regra). Espelhar `clerk-membership.test.ts`.

### Implementation for User Story 1

- [x] T013 [US1] Em `src/shared/db/repositories/orgs.ts`: `createTenant({ id?, name?, plan?, clerkOrgId? })` — insert com `plan` default `free`, id `gen_random_uuid()::text` quando ausente. (depende de T007)
- [x] T014 [US1] Em `src/shared/db/repositories/org-memberships.ts`: `ensureOwnerMembership({ orgId, userId })` — upsert `role='owner'` com `onConflict (org_id,user_id)`. Valor de `role` no domínio nosso em inglês (`owner｜collaborator｜client`); o papel nativo do Clerk (`org:admin`…) é do caminho PRO, não escrito aqui. (depende de T008)
- [x] T015 [US1] Criar `src/shared/tenant/provision-personal-tenant.ts`: `provisionPersonalTenant({ userId, name? })` idempotente — checa membership `owner` de tenant pessoal (`clerk_org_id IS NULL`); senão cria `orgs`+membership via cliente admin (`getRlsBypassingSupabaseClient`, **sem** `withOrg`); emite `logTenantEvent("info", { operation:"tenant.provisioned", outcome:"ok" })` só quando `created`. (depende de T013, T014)
- [x] T016 [US1] Criar `src/shared/tenant/active-tenant.ts` (`resolveActiveTenant(userId)` lendo memberships + `plan` via join `orgs`) e `src/shared/auth/require-tenant-context.ts` (`requireTenantContext(): { userId, tenantId, plan, role }`) — 0 memberships → `provisionPersonalTenant` + re-resolve, falha real → `NoTenantContextError`; 1 membership → esse. Origem sempre `userId`→memberships. (depende de T015, T009)
- [x] T017 [US1] Em `src/shared/clerk-sync/clerk-sync-service.ts`: no case `user.created`, após `syncUser`/`replaceUser`, chamar `provisionPersonalTenant({ userId: data.id, name: nameFrom(data) })`; erro propaga → webhook 500 → Clerk reentrega (idempotente). (depende de T015)
- [x] T018 [US1] Em `src/app/(protected)/layout.tsx`: usar `requireTenantContext()` para abrir a área autenticada; `NoTenantContextError` → mesmo caminho de bloqueio/redirecionamento "sem org ativa" da `004`. `requireOrgContext()` permanece para o caminho Clerk-org do PRO (não remover). (depende de T016)

**Checkpoint**: US1 funcional e testável isoladamente — MVP. Cadastro → tenant próprio ativo.

---

## Phase 4: User Story 2 — Backstop de isolamento por tenant (Priority: P1)

**Goal**: `companies` (primeira tabela de negócio) herda o backstop de RLS por `org_id`: tenant A
ativo só vê A; sem tenant ativo, vazio; escrita cross-tenant rejeitada pelo banco. (FR-005..010;
SC-002/003/004/005)

**Independent Test**: Contra **Postgres efêmero**, fixar A via `withOrg` e ver só A; fixar B e ver
0 de A; sem `set_config`, 0 linhas; inserir `org_id=B` sob A → rejeitado por `WITH CHECK`.

### Tests for User Story 2 ⚠️ (escrever ANTES; devem falhar)

- [x] T019 [P] [US2] Integração RLS (Postgres efêmero) `src/__tests__/integration/shared/db/companies-isolation.test.ts`: espelhar `tenant-isolation.test.ts` para `companies` — A só vê A; sem tenant → vazio; tenant inválido → vazio; escrita cross-tenant (`org_id` ≠ ativo) rejeitada; escopo por transação (valor não vaza fora da `withOrg`). `describe.skip` sem `INTEGRATION_*`.

### Implementation for User Story 2

- [x] T020 [US2] Criar `src/shared/db/repositories/companies.ts`: leitura/inserção tenant-scoped executadas **dentro** de `withOrg(tenantId, tx)` (insert sem `org_id` explícito do cliente — derivado do tenant ativo). Sustenta o teste T019 e o padrão para módulos de negócio futuros. (schema/GRANT já vêm de T003/T006)

**Checkpoint**: US1 + US2 funcionam de forma independente; backstop de `companies` provado.

---

## Phase 5: User Story 3 — Campo de plano do tenant (free|pro) (Priority: P1)

**Goal**: Todo tenant tem `plan ∈ {free,pro}`, default `free`, nunca nulo; permissão/feature é
resolvida pelo **plano do tenant ativo** (Inv-1), nunca por "plano do usuário". (FR-011/012;
SC-006/007)

**Independent Test**: Insert sem `plan` → `free`; `plan='x'` → rejeitado; `requireTenantContext`
retorna o `plan` do tenant ativo; `isTeamManagementAvailable` reflete o campo (sem enforcement).

### Tests for User Story 3 ⚠️ (escrever ANTES; devem falhar)

- [x] T021 [P] [US3] Unit `src/__tests__/unit/shared/tenant/plan.test.ts`: default `free`; resolução pelo tenant ativo (usuário com vínculos free e pro → plano vem do ativo, não global); `isTeamManagementAvailable('free')===false` e `('pro')===true` (campo apenas, sem bloqueio).
- [x] T022 [P] [US3] Integração (Postgres efêmero) `src/__tests__/integration/shared/db/orgs-plan-constraint.test.ts`: insert sem `plan` → `free`; `UPDATE orgs SET plan='x'` → rejeitado pelo `CHECK` (SC-006). _(constraint-level; complementa o unit T021)_

### Implementation for User Story 3

- [x] T023 [US3] Criar `src/shared/tenant/plan.ts`: `isTeamManagementAvailable(plan)` (ponto único do Gate PRO futuro, **sem** enforcement) e `resolvePlan` a partir do tenant ativo; garantir que `requireTenantContext` (T016) já devolve `plan` do tenant ativo via join. (depende de T016)

**Checkpoint**: US1+US2+US3 (todas P1) verdes — fatia entregável como incremento.

---

## Phase 6: User Story 4 — Uma identidade, vários escritórios (Priority: P2)

**Goal**: Modelo suporta N vínculos aditivos por identidade; papel/plano resolvidos por vínculo do
tenant ativo; elegibilidade ao seletor = 2+ vínculos. (FR-003/017/019/020; SC-008/009/010)
_Renderização do seletor e troca efetiva são futuras._

**Independent Test**: Identidade com 2 vínculos (owner do próprio + colaborador de terceiro) →
ambos coexistem; `isSwitcherEligible(1)===false`, `(2)===true`; com tenant ativo PRO, plano segue o PRO.

### Tests for User Story 4 ⚠️ (escrever ANTES; devem falhar)

- [x] T024 [P] [US4] Unit `src/__tests__/unit/shared/tenant/switcher-eligibility.test.ts`: `isSwitcherEligible` 1→false / 2+→true (SC-010); coexistência aditiva de memberships (2º vínculo não substitui o 1º — SC-008).

### Implementation for User Story 4

- [x] T025 [US4] Em `src/shared/tenant/active-tenant.ts`: `isSwitcherEligible(membershipCount): boolean` (`>= 2`). (depende de T016)
- [x] T026 [US4] Em `src/shared/auth/require-tenant-context.ts`: ramo **2+ memberships** — escolher pelo cookie `ACTIVE_ORG_COOKIE` (constante confirmada `= "tenant_active_org"` em `src/shared/tenant/org-switch.ts:3`; reutilizar `reconcileActiveOrg`) se apontar para membership válido; senão **bloqueio determinístico** (nunca default ambíguo). (depende de T016, T025)

**Checkpoint**: Modelo multi-tenant por identidade provado; seletor permanece fora de escopo.

---

## Phase 7: User Story 5 — Acesso de cliente restrito a uma empresa (Priority: P2)

**Goal**: Modelo do papel `cliente` (vínculo com `scoped_company_id`) + empresa-cliente como
dimensão dentro do tenant; mesmo CNPJ em dois tenants → duas `companies` distintas. (FR-010/016/018;
SC-011) _Policy de enforcement do escopo por empresa é futura (SC-012)._

**Independent Test**: `scoped_company_id` referencia uma `companies` válida; inserir o mesmo `cnpj`
em tenants A e B → duas linhas distintas (uq é por `org_id`, sem único global).

### Tests for User Story 5 ⚠️ (escrever ANTES; devem falhar)

- [x] T027 [P] [US5] Integração (Postgres efêmero) `src/__tests__/integration/shared/db/companies-scope-model.test.ts`: mesmo `cnpj` em A e B → 2 `companies` distintas (FR-018/SC-011); `uq_companies_org_id_cnpj` rejeita duplicata **intra**-tenant; `org_memberships.scoped_company_id` aceita FK válida e rejeita id inexistente.

### Implementation for User Story 5

- [x] T028 [US5] Sem código novo de produto — schema (`scoped_company_id` FK + `uq (org_id,cnpj)`) já entregue em T003/T004/T006. Confirmar no teste T027 que o modelo sustenta o papel `cliente`; **enforcement** da policy `AND company_id = scoped_company_id` fica registrado como futuro (Out of Scope).

**Checkpoint**: Fundação do papel `cliente` modelada e provada estruturalmente.

---

## Phase 8: User Story 6 — Preservação previsível no ciclo de vida (Priority: P3)

**Goal**: "Sem tenant ativo" → bloqueio sem vazar dados (FR-024). Regras de downgrade/último
proprietário/cascata ficam **registradas** (FR-021/022/023 — enforcement futuro).

**Independent Test**: Usuário sem tenant ativo (ou removido do tenant ativo) → `NoTenantContextError`
→ bloqueio; 0 linhas de negócio retornadas; nunca dados de outro tenant.

### Tests for User Story 6 ⚠️ (escrever ANTES; devem falhar)

- [x] T029 [P] [US6] Integração `src/__tests__/integration/auth/no-tenant-block.test.ts`: sessão sem membership resolvível (após self-heal falho / remoção) → bloqueio (`NoTenantContextError`), área autenticada não carrega dados; espelhar `no-org-block.test.ts` (FR-024).

### Implementation for User Story 6

- [x] T030 [US6] Sem código novo — caminho de bloqueio já entregue em T016/T018. FR-021 (suspensão no downgrade), FR-022 (proibir remover último proprietário) e FR-023 (cascata de deleção) permanecem **regras registradas**, sem enforcement nesta fatia (spec → Out of Scope). Confirmar o bloqueio com T029.

**Checkpoint**: Fronteira de "sem tenant ativo" segura; regras de ciclo de vida registradas.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Auditoria, gates e validação final da fatia.

- [x] T031 [P] Auditoria (FR-026): garantir `logTenantEvent` com correlação (`requestId`, `orgId`/tenant, `userId`, `operation`) e **sem** PII/segredos nos três eventos de fronteira — `tenant.provisioned` (T015), bloqueio por falta de tenant ativo (T016/T018) e rejeição cross-tenant (T019). Reutilizar `src/shared/tenant/audit-log.ts`.
- [ ] T032 Quality Gate (constituição): `npm run lint`, `npx tsc --noEmit`, `npm run test` e `npm run test:integration` (com `INTEGRATION_*` para os `describe` de RLS) — todos verdes. — ✅ lint/tsc/unit (65) verdes; integração app-layer verde; os 3 `describe` de RLS (`companies-isolation`, `orgs-plan-constraint`, `companies-scope-model`) ficam **skip** sem `INTEGRATION_*`. ⚠️ Suíte **pré-existente** `clerk-membership.test.ts` quebra na importação sem `NEXT_PUBLIC_SUPABASE_*` no ambiente Jest (estado de baseline da T001, não introduzido pela 005). Gate completo requer ambiente com `NEXT_PUBLIC_SUPABASE_*` + `INTEGRATION_*`.
- [ ] T033 Validação manual do `quickstart.md` (5 passos): cadastro → 1 `orgs` free + 1 membership owner; free opera sozinho; `plan` default free e `CHECK` rejeita valor inválido; isolamento de `companies` por `app.current_org`; reenvio de `user.created` sem duplicar tenant. — ⚠️ **PENDENTE (manual)**: requer a migration `0004` aplicada (T006) e um ambiente com DB; executar após `npm run db:migrate`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup; **bloqueia todas** as user stories. Ordem interna: T003 → T004 → T005; T002/T003/T004/T005 → T006 (migration); T002 → T007; T004 → T008.
- **User Stories (Phase 3+)**: todas dependem da Foundational concluída (schema migrado).
  - US2 (RLS) e US3 (plano) dependem só do schema (Foundational), não de US1 — podem ser paralelas a US1.
  - US4, US5, US6 dependem do resolver `requireTenantContext` (T016, em US1) e do schema.
- **Polish (Phase 9)**: depende de todas as stories desejadas concluídas.

### User Story Dependencies

- **US1 (P1)**: após Foundational. Entrega o resolver `requireTenantContext` (T016) usado por US3/US4/US6.
- **US2 (P1)**: após Foundational. Independente de US1 (só schema + `withOrg` herdado).
- **US3 (P1)**: após Foundational; usa `plan` do resolver (T016 de US1) na parte de app-layer.
- **US4 (P2)**: após US1 (estende T016).
- **US5 (P2)**: após Foundational (schema). Sem dependência de outras stories.
- **US6 (P3)**: após US1 (caminho de bloqueio de T016/T018).

### Within Each User Story

- Testes escritos e **falhando** antes da implementação (TDD).
- Repositório (mapping/métodos) antes do service; service antes do resolver/handler; resolver antes do `layout.tsx`.

### Parallel Opportunities

- Foundational: T003 e (após ele) T007/T008/T009 marcados [P] em arquivos distintos.
- US1: testes T010/T011/T012 em paralelo; T013 e T014 em paralelo (arquivos distintos).
- Stories P1 entre si: US2 e US3 podem rodar em paralelo a US1 (dependem só do schema).

---

## Parallel Example: User Story 1

```bash
# Testes de US1 juntos (devem falhar primeiro):
Task: "Unit provision-personal-tenant.test.ts (idempotência/owner/free)"
Task: "Unit active-tenant.test.ts (1→ele; 0→self-heal; input do cliente ignorado)"
Task: "Integração clerk-user-provisioning.test.ts (SQLite, idempotente)"

# Repositórios de US1 juntos (arquivos distintos):
Task: "createTenant() em repositories/orgs.ts"
Task: "ensureOwnerMembership() em repositories/org-memberships.ts"
```

---

## Implementation Strategy

### MVP First (P1: US1 + US2 + US3)

1. Phase 1 (Setup) → Phase 2 (Foundational, CRÍTICA — bloqueia tudo).
2. US1 (workspace no cadastro) → **STOP & VALIDATE** (cadastro → tenant próprio ativo).
3. US2 (backstop de `companies`) → validar RLS contra Postgres efêmero.
4. US3 (campo de plano) → validar default/CHECK e resolução pelo tenant ativo.
5. As três P1 verdes = fatia entregável.

### Incremental Delivery

- P1 (US1/US2/US3) entrega o núcleo (tenant + isolamento + plano).
- P2 (US4 multi-tenant por identidade; US5 modelo do `cliente`) adiciona fundação sem quebrar P1.
- P3 (US6 fronteira de ciclo de vida) fecha o comportamento de bloqueio.

### Notas

- **Fora desta fatia** (regras registradas, enforcement futuro): Gate PRO, convite/UI Equipe e
  Acessos, auto-criação de Clerk Org no upgrade, policy de escopo por empresa do `cliente`, seletor
  de troca, billing, suspensão no downgrade, proibição de remover último proprietário, cascata de
  deleção. Ver `spec.md` → Out of Scope.
- RLS **nunca** em SQLite — `companies`/`orgs` constraints provados contra Postgres efêmero
  (`INTEGRATION_*`). App-layer e regra de negócio em mocks/SQLite.
- **Sem tarefa de código dedicada** (cobertura estrutural/reuso): FR-004 (1 identidade/CPF)
  é assegurada pelo provedor de auth + PK `users.id` (reconciliação por convite é futura);
  FR-025 (validação por schema) é reutilizada do webhook (`verifyWebhook` + zod), asserida
  por T012. Papel `role` no domínio inglês `owner｜collaborator｜client` (mapeia
  `proprietário｜colaborador｜cliente`).
- Commit por tarefa ou grupo lógico; parar em qualquer checkpoint para validar a story isolada.
