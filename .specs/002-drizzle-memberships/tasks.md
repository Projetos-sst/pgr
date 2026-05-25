---
description: "Task list for Drizzle ORM + org_memberships"
---

# Tasks: Drizzle ORM + `org_memberships`

**Input**: Design documents from `/specs/002-drizzle-memberships/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/db-client.md, contracts/webhook-handlers.md, contracts/backfill-script.md, quickstart.md

**Tests**: Obrigatórios pela seção "Fluxo de Desenvolvimento & Quality Gates" da constituição. Unitários para lógica pura (env, mappers, repositories); integração contra Postgres efêmero do Supabase para RLS/triggers/papel — exceção justificada ao mandato de SQLite em memória, registrada em `plan.md > Complexity Tracking` e detalhada em `research.md > R5`.

**Organization**: Por user story. US1, US2 e US4 são P1; US3 é P2. US4 (menor privilégio) compartilha a DDL com US1 — separadas para clareza de teste, executadas em paralelo após Foundational.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[Story]**: rótulo de user story; ausente em Setup/Foundational/Polish

## Path Conventions

Monorepo Next.js existente. Paths a partir da raiz do repositório.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Instalar ferramental e declarar configuração base.

- [x] T001 Instalar dependências `drizzle-orm` e `postgres` em `package.json` (runtime) e `drizzle-kit` em `devDependencies`; confirmar versões mais recentes estáveis via Context7 antes de fixar.
- [x] T002 [P] Adicionar entradas `DATABASE_URL`, `DATABASE_URL_UNPOOLED` e `APP_RUNTIME_DB_PASSWORD` em `/.env.example` com placeholders e comentários explicando pooler vs. direta (sem credenciais reais).
- [x] T003 [P] Adicionar scripts `db:generate`, `db:migrate`, `db:studio` em `/package.json` conforme `specs/002-drizzle-memberships/quickstart.md#scripts-npm-novos`.
- [x] T004 Criar `/drizzle.config.ts` apontando `schema: 'lib/db/schema'`, `out: 'lib/db/migrations'`, `dialect: 'postgresql'`, lendo `DATABASE_URL_UNPOOLED` do env e validando-o com zod (parsing da URL): MUST rejeitar com erro explícito se a porta for diferente de `5432` ou o usuário for diferente de `postgres` (espelha a guarda simétrica que T017 aplica ao runtime). Cobre o edge case de "Drizzle Kit acidentalmente apontado pro pooler".

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Estrutura do `lib/db/` + schemas + DDL custom + papel restrito + primeira migration aplicada. Sem isto, nenhuma user story roda.

**CRITICAL**: Nenhuma user story pode começar antes deste checkpoint.

- [x] T005 Criar a árvore de diretórios: `lib/db/`, `lib/db/schema/`, `lib/db/repositories/`, `lib/db/migrations/`, `scripts/` (se não existir).
- [x] T006 Criar `/scripts/db-reset-dev.ts` que conecta com `DATABASE_URL_UNPOOLED`, dropa em ordem `org_memberships`, `orgs`, `users`, função `public.set_updated_at` (CASCADE), e role `app_runtime`; guarda explícita lançando erro se `NODE_ENV === 'production'`.
- [x] T007 Criar `/scripts/db-migrate.ts` (wrapper de `drizzle-kit migrate`) que: (a) lê `DATABASE_URL_UNPOOLED` + `APP_RUNTIME_DB_PASSWORD` e os valida (mesma guarda do T004: porta=5432, usuário=`postgres`; falhar explicitamente se for o pooler); (b) executa `SET app.app_runtime_password = $env` na sessão antes de invocar o runner; (c) chama o runner programaticamente. Documentar no header do arquivo.
- [x] T008 [P] Declarar `/lib/db/schema/users.ts` com `pgTable('users', ...)` autoritativo (colunas, defaults, PK), exportar `User` e `NewUser` via `InferSelectModel`/`InferInsertModel`, e a policy `users_select_self` via `pgPolicy` (ou marcador para SQL custom se a versão fixada não suportar).
- [x] T009 [P] Declarar `/lib/db/schema/orgs.ts` análogo a T008: colunas, `UNIQUE` em `slug`, policy `orgs_select_active_org`.
- [x] T010 [P] Declarar `/lib/db/schema/org-memberships.ts` com colunas, PK composta `(org_id, user_id)`, índice `org_memberships_user_idx` em `(user_id)`, FKs com `onDelete: 'cascade'`, policy `org_memberships_select_active_org` (SELECT para `authenticated` quando `org_id = auth.jwt() ->> 'org_id'`), sem policies de escrita.
- [x] T011 Criar barrel `/lib/db/schema/index.ts` reexportando `users`, `orgs`, `orgMemberships` e seus tipos `Select`/`Insert` conforme `contracts/db-client.md`.
- [x] T012 Criar migration SQL custom dedicada `/lib/db/migrations/0001_set_updated_at.sql` (NÃO anexar à migration gerada, para manter diffs legíveis) com a função `public.set_updated_at()` + triggers `BEFORE UPDATE` em `users`, `orgs`, `org_memberships`. Registrar no `meta/_journal.json` do Drizzle Kit (ou via `drizzle-kit generate --custom`). Conteúdo exato em `specs/002-drizzle-memberships/data-model.md#função-e-trigger-compartilhada`.
- [x] T013 Criar migration SQL custom dedicada `/lib/db/migrations/0002_app_runtime_role.sql` (idem T012, arquivo próprio) com `CREATE ROLE app_runtime` (idempotente via `do $$`), `nobypassrls`, `noinherit`, senha via `current_setting('app.app_runtime_password')`, e `GRANT usage on schema public` + `GRANT select, insert, update, delete on public.users|orgs|org_memberships to app_runtime`. Bloco exato em `data-model.md#papel-restrito-do-runtime`.
- [x] T014 Rodar `npm run db:generate` para materializar a primeira migration Drizzle a partir dos schemas declarados (T008–T011); confirmar que o SQL gerado contém as três tabelas, PK composta, FKs CASCADE, índice em `user_id` e habilitação de RLS.
- [ ] T015 Executar `npx tsx scripts/db-reset-dev.ts` seguido de `npm run db:migrate` contra o Supabase de dev; validar que sem erro e que: (a) as três tabelas existem (`\dt public.*`); (b) a função `public.set_updated_at` existe (`\df public.set_updated_at`); (c) triggers `BEFORE UPDATE` estão presentes nas três tabelas (`select tgname, tgrelid::regclass from pg_trigger where tgname like 'set_updated_at%'`); (d) papel `app_runtime` existe sem `BYPASSRLS` (`select rolname, rolbypassrls from pg_roles where rolname='app_runtime'`, MUST: `rolbypassrls=false`); (e) policies RLS esperadas existem (`select policyname, tablename from pg_policies where schemaname='public'`, conferir `users_select_self`, `orgs_select_active_org`, `org_memberships_select_active_org`); (f) GRANTs para `app_runtime` cobrem `SELECT/INSERT/UPDATE/DELETE` nas três tabelas (`select table_name, privilege_type from information_schema.role_table_grants where grantee='app_runtime'`).
- [x] T016 Remover `/supabase/migrations/0001_clerk_sync_init.sql` e (se a pasta ficar vazia) `/supabase/migrations/` e `/supabase/`. Commitar a remoção junto com a primeira migration Drizzle.

**Checkpoint**: Foundation pronta. As tabelas existem, o papel restrito existe, o ferramental funciona. User stories podem começar em paralelo.

---

## Phase 3: User Story 1 — Infraestrutura Drizzle disponível (Priority: P1) MVP

**Goal**: Cliente Drizzle (`lib/db/index.ts`) operacional via pooler em transaction mode com papel `app_runtime`, executando query trivial em ambiente local e CI. `db:generate` e `db:migrate` ponta a ponta funcionais. Bundle do cliente Next.js livre de Drizzle.

**Independent Test**: smoke `select 1 as ok, current_user as who` retorna `[{ ok: 1, who: 'app_runtime' }]`; build de produção do Next.js completa sem incluir `drizzle-orm` no chunk de cliente.

### Implementation for User Story 1

- [x] T017 [US1] Criar `/lib/db/index.ts` com `import 'server-only'` no topo, leitura/validação de `DATABASE_URL` (zod schema rejeitando porta diferente de 6543 e usuário diferente de `app_runtime`), construção do cliente `postgres-js` com `{ prepare: false, max: 1, idle_timeout: 20 }` e export `db = drizzle(client, { schema })`. Comentário documentando R3/R4 (escopo admin/sistema, sem JWT do Clerk).
- [x] T018 [P] [US1] Criar teste unitário `/tests/unit/lib/db/env.test.ts` cobrindo: env válida resolve, porta errada lança, usuário errado lança, env ausente lança.
- [x] T019 [US1] Criar smoke test executável `/tests/integration/lib/db/smoke.test.ts` (runs em integration project) que importa `db` e executa `select 1 as ok, current_user as who`; assertiva `ok === 1` e `who === 'app_runtime'`. Documentar requisito de `INTEGRATION_DATABASE_URL`.
- [x] T020 [P] [US1] Adicionar regra de lint (custom eslint rule ou check via `grep`/script no `npm run lint`) que falha se algum arquivo sob `app/` ou `components/` que não comece com `'use server'` importar de `@/lib/db`. Alternativa simples: script `scripts/check-no-db-in-client.sh` invocado por `lint`.

**Checkpoint**: Drizzle conecta como papel restrito, queries básicas funcionam, bundle do cliente protegido.

---

## Phase 4: User Story 4 — Acesso ao banco respeita menor privilégio (Priority: P1)

**Goal**: Verificar empiricamente que o papel `app_runtime` é restrito e a RLS é backstop real. Pode rodar em paralelo com US1 (ambas dependem apenas da Foundational).

**Independent Test**: três testes de integração descritos abaixo passam contra o Postgres efêmero, demonstrando isolamento por org e bloqueio de escrita.

### Implementation for User Story 4

- [x] T021 [P] [US4] Teste de integração em `/tests/integration/lib/db/least-privilege.test.ts`: conectar via `db` (papel `app_runtime`), executar `select current_user`; assertiva ≠ `'postgres'` e ≠ `'service_role'`, igual `'app_runtime'`. Inspecionar `pg_roles` para confirmar ausência de `rolbypassrls`.
- [x] T022 [P] [US4] No mesmo arquivo (ou irmão), tentar `insert into org_memberships values (...)`, `update org_memberships set role=...`, `delete from org_memberships where ...` via `db`; cada operação MUST lançar erro de permissão/RLS. Asserts validando o tipo do erro.
- [x] T023 [P] [US4] Teste de integração: simular dois conjuntos de claims (`{org_id:'org_a'}` e `{org_id:'org_b'}`) via `select set_config('request.jwt.claims', $1, true)` por conexão; inserir 2 memberships (uma de cada org via admin client/raw); `select * from org_memberships` no contexto de cada claim MUST retornar apenas a row correspondente. Sem claims (`request.jwt.claims` null) MUST retornar 0 linhas.

**Checkpoint**: Provas empíricas de isolamento e menor privilégio antes de qualquer feature de leitura/escrita ser construída em cima.

---

## Phase 5: User Story 2 — Sincronização automática de `org_memberships` via Clerk (Priority: P1)

**Goal**: Os três eventos `organizationMembership.{created,updated,deleted}` chegam ao webhook e refletem corretamente em `org_memberships`, com upsert defensivo de `users`/`orgs` para tolerar qualquer ordem de entrega.

**Independent Test**: testes unitários cobrem os três handlers + casos de borda; testes de integração validam o estado real do DB após cada evento, inclusive cenário de membership chegando antes de `user.created`/`organization.created`.

### Implementation for User Story 2

- [x] T024 [P] [US2] Criar `/lib/clerk/membership-event-mappers.ts` com schemas Zod (`OrganizationMembershipPayload`) e três mappers puros: `toUserRow(payload)`, `toOrgRow(payload)`, `toOrgMembershipRow(payload)`, retornando os tipos `NewUser`/`NewOrg`/`NewOrgMembership` dos schemas Drizzle.
- [x] T025 [P] [US2] Testes unitários `/tests/unit/clerk/membership-event-mappers.test.ts` cobrindo: payloads válidos mapeiam corretamente; campos ausentes viram `null`; payload inválido lança erro Zod com mensagem útil.
- [x] T026 [P] [US2] Criar `/lib/db/repositories/users.ts` com `upsertUser(input: NewUser): Promise<User>` que delega a `getSupabaseAdminClient().from('users').upsert(...)` (R4) e usa `onConflict: 'id'` com `coalesce` para não sobrescrever campos populados com `null`/`undefined`.
- [x] T027 [P] [US2] Criar `/lib/db/repositories/orgs.ts` análogo a T026 para `upsertOrg`.
- [x] T028 [P] [US2] Criar `/lib/db/repositories/org-memberships.ts` com `upsertOrgMembership(input: NewOrgMembership): Promise<OrgMembership>` (conflict em PK composta atualiza `role` e `updated_at`) e `deleteOrgMembership({orgId, userId}): Promise<void>` (no-op se ausente).
- [x] T029 [US2] Estender `/app/api/webhooks/clerk/route.ts`: adicionar 3 casos no switch — `organizationMembership.created`, `.updated`, `.deleted`. `created`/`updated` chamam `upsertUser` → `upsertOrg` → `upsertOrgMembership` (nessa ordem). `deleted` chama apenas `deleteOrgMembership`. Mantém verificação Svix existente como guarda anterior. Logs estruturados sem dados sensíveis.
- [x] T030 [P] [US2] Testes unitários `/tests/unit/webhooks/membership-handlers.test.ts` com `upsertUser`/`upsertOrg`/`upsertOrgMembership`/`deleteOrgMembership` mockados: validar ordem de chamadas, dados mapeados, comportamento em payload inválido (400, zero chamadas), falha Svix (401).
- [x] T031 [P] [US2] Testes de integração `/tests/integration/webhooks/clerk-membership.test.ts` contra Postgres efêmero: (a) `created` insere row; segunda entrega não duplica; (b) `updated` muda `role` e avança `updated_at`; (c) `deleted` remove row; segunda entrega no-op; (d) cenário "membership chega antes de user/org" — após o evento, `users`/`orgs` têm rows mínimas; evento `user.created` posterior enriquece sem sobrescrever campos não-`null`.
- [x] T040 [P] [US2] Testes unitários dos repositories em `/tests/unit/lib/db/repositories/{users,orgs,org-memberships}.test.ts` com `getSupabaseAdminClient` mockado, cobrindo (FR-027): (a) `upsertUser`/`upsertOrg` chamam `from('<table>').upsert(...)` com `onConflict: 'id'`, e a estratégia de merge NÃO sobrescreve campos com `null`/`undefined` quando a linha já tem valor (coalesce/excluded); (b) `upsertOrgMembership` usa conflict-target na PK composta `(org_id, user_id)` e atualiza apenas `role`/`updated_at`; (c) `deleteOrgMembership` invoca `.delete().match({ org_id, user_id })` e resolve normalmente quando 0 rows são afetadas (no-op).

**Checkpoint**: Webhook sincroniza memberships ponta a ponta; cobertura cobre os critérios de aceite de US2.

---

## Phase 6: User Story 3 — Backfill de memberships existentes (Priority: P2)

**Goal**: Script `scripts/backfill-memberships.ts` popula `org_memberships` para todas as orgs/membros já existentes no Clerk, idempotente.

**Independent Test**: rodar 2× consecutivas contra ambiente de dev; primeira execução popula, segunda é no-op (sem duplicatas, sem alterações além de `updated_at`).

### Implementation for User Story 3

- [x] T032 [US3] Criar `/scripts/backfill-memberships.ts` conforme `contracts/backfill-script.md`: pagina `clerkClient.organizations.getOrganizationList`, e para cada org pagina `getOrganizationMembershipList`; para cada membership invoca `upsertOrg`, `upsertUser`, `upsertOrgMembership`. Tratamento de erro por item (loga + continua); resumo final + exit code apropriado.
- [x] T033 [P] [US3] Teste de integração `/tests/integration/scripts/backfill-memberships.test.ts` com SDK do Clerk mockado e DB efêmero. Fixtures: N orgs com M memberships totais conhecidos. Assertivas: (a) **cobre SC-002** — após 1ª execução, `select count(*) from org_memberships` MUST retornar exatamente `M` (igual à soma dos memberships dos fixtures Clerk mockados); (b) idempotência — 2ª execução não cria rows adicionais (`count` permanece `M`), e somente `updated_at` pode avançar; (c) resiliência — uma org configurada para falhar (mock lança) não interrompe as demais; contagem de `errors` ≥ 1, exit code = 1, e as outras orgs aparecem normalmente.

**Checkpoint**: backfill operacional, idempotente, validado.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T034 Atualizar `/CLAUDE.md` se houver drift entre os comandos/paths de scripts no quickstart e a versão atual; verificar bloco `<!-- SPECKIT ... -->` ainda aponta para esta fatia (já atualizado pelo `/speckit-plan`).
- [ ] T035 Atualizar Dashboard Clerk → Webhooks → endpoint do `/api/webhooks/clerk`: adicionar subscriptions `organizationMembership.created`, `organizationMembership.updated`, `organizationMembership.deleted`. Documentar conclusão em PR description.
- [ ] T036 Executar `npm run lint && npm run typecheck && npm run test && npm run test:integration` — todos exit 0. Capturar output no PR para evidência.
- [ ] T037 Rodar o `specs/002-drizzle-memberships/quickstart.md` ponta a ponta num ambiente limpo (ou simulado) para validar que as instruções estão completas e corretas; ajustar quickstart se necessário.
- [ ] T038 [P] Executar `scripts/backfill-memberships.ts` no ambiente de dev pós-deploy do webhook, confirmar contagem de memberships bate com Clerk Dashboard, e re-executar para validar idempotência.
- [ ] T039 [P] Inspecionar bundle de produção (`next build` + análise do output `.next/static/chunks/`) confirmando ausência de `drizzle-orm`, `postgres-js`, e qualquer referência a `DATABASE_URL`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: sem dependências.
- **Phase 2 (Foundational)**: depende de Phase 1; **bloqueia** Phases 3–6.
- **Phase 3 (US1)** e **Phase 4 (US4)**: dependem apenas de Phase 2; podem rodar em paralelo entre si.
- **Phase 5 (US2)**: depende de Phase 2 (precisa da tabela e do admin client). NÃO depende estritamente de US1/US4, mas é prudente concluir T015 (migrate aplicada) antes dos testes de integração.
- **Phase 6 (US3)**: depende de Phase 5 estar funcional (reusa repositories de T026–T028). Pode começar implementação em paralelo, mas testes finais precisam dos repos prontos.
- **Phase 7 (Polish)**: depende de todas as anteriores.

### Within Each User Story

- US1: T017 antes de T018 (testes importam de `lib/db/index.ts`); T020 independente.
- US4: T021–T023 independentes entre si (todos em arquivo único de integração).
- US2: T024 antes de T025 e T029; T026–T028 antes de T029, T030, T031 e T040.
- US3: T032 antes de T033.

### Parallel Opportunities

- **Phase 1**: T002, T003 paralelos a T001.
- **Phase 2**: T008, T009, T010 paralelos (arquivos diferentes); T012 e T013 também paralelos uma vez que sejam SQL custom em arquivos próprios.
- **Phase 3 vs Phase 4**: paralelas (devs diferentes podem pegar US1 e US4 simultaneamente).
- **Phase 5**: T024, T026, T027, T028 paralelos; T030, T031 e T040 paralelos após repos prontos.

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Após T005–T007 e dentro de Phase 2, lançar em paralelo:
Task: "Declarar lib/db/schema/users.ts (T008)"
Task: "Declarar lib/db/schema/orgs.ts (T009)"
Task: "Declarar lib/db/schema/org-memberships.ts (T010)"
# Depois T011 sequencial (barrel), T012/T013 paralelos (DDLs custom),
# T014 sequencial (generate), T015 sequencial (reset+migrate), T016.
```

## Parallel Example: US1 + US4 após Foundational

```bash
# Dev A:
Task: "T017 lib/db/index.ts"
Task: "T018 testes de env"
Task: "T019 smoke test"
Task: "T020 lint rule de bundle"

# Dev B em paralelo:
Task: "T021 current_user check"
Task: "T022 RLS write-block test"
Task: "T023 RLS per-org isolation test"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 (Setup) + Phase 2 (Foundational) completas — Drizzle aplicou a primeira migration e o papel `app_runtime` existe.
2. Phase 3 (US1) — cliente Drizzle valida ponta a ponta.
3. Phase 4 (US4) — provas empíricas de menor privilégio.
4. Phase 5 (US2) — webhook sincroniza memberships.
5. **STOP & VALIDATE**: o sistema já entrega 100% do valor funcional desta fatia (estrutura code-first + sincronização). Phase 6 é melhoria operacional.

### Incremental Delivery

- Foundational pronto → cliente Drizzle utilizável por features futuras.
- - US1/US4 → segurança e ferramental validados.
- - US2 → `org_memberships` populada continuamente.
- - US3 → estado consistente desde o estado inicial das orgs existentes.
- - Polish → cleanup e validação final.

### Parallel Team Strategy

Após Foundational, dividir:

- Dev A → US1 + US4 (afinidade com infra/Drizzle).
- Dev B → US2 (afinidade com Clerk/webhook).
- Dev A ou B → US3 quando US2 repos estiverem prontos.

---

## Notes

- Testes obrigatórios (Constituição V): unit + integration. Integração desta fatia usa Postgres efêmero (R5), não SQLite — exceção justificada e documentada.
- `[P]` significa arquivos diferentes e sem dependência pendente. Em caso de dúvida, sequencializar.
- Commitar por checkpoint (após cada Phase ou agrupamento lógico) facilita reverter sem perder trabalho.
- Não pular Foundational: papel restrito + DDL portada são pré-requisitos de tudo. Atalhos viram dívida.
