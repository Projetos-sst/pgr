# Feature Specification: Drizzle ORM + `org_memberships`

**Feature Branch**: `feature/drizzle-orm-setup`

**Created**: 2026-05-25

**Status**: Draft

**Input**: Configurar a camada de persistência da aplicação com Drizzle ORM contra o Postgres do Supabase, incluindo ferramental de migrations versionadas (Drizzle Kit) e a primeira tabela relacional gerenciada por Drizzle: `org_memberships` (relação user ↔ org + role), sincronizada via webhook do Clerk.

## Clarifications

### Session 2026-05-25

- Q: Escopo de uso do Drizzle vs. contexto-por-usuário (RLS via JWT do Clerk) nesta fatia? → A: Drizzle só fora do contexto-por-usuário nesta fatia (uso admin/sistema). Dados por-usuário continuam via `supabase-js` carregando o JWT do Clerk. Documentar essa fronteira explicitamente.
- Q: Ownership das migrations (Drizzle vs. SQL puro em `supabase/migrations/`)? → A: Drizzle Kit é o **único** dono da estrutura do banco. As migrations existentes em `supabase/migrations/` (atualmente `0001_clerk_sync_init.sql`, cobrindo `users`/`orgs`, RLS e trigger `set_updated_at`) MUST ser portadas para schemas Drizzle + migrations geradas em `lib/db/migrations/`, e a pasta `supabase/migrations/` MUST ser removida ao final da fatia. Objetivo: estrutura do banco totalmente codada em um único sistema, replicável em qualquer ambiente.
- Q: Como Drizzle adota o estado pré-existente de `users`/`orgs` no Supabase (que já existem como tabelas)? → A: Projeto está em estágio inicial — só existe banco de dev e as tabelas estão vazias, sem dados a preservar. A estratégia é **drop + recreate limpo**: dropar `users`, `orgs`, suas policies RLS e o trigger/função `set_updated_at` no Supabase de dev, depois aplicar normalmente a primeira migration Drizzle (que recria tudo + cria `org_memberships`). Nada de baseline, nada de DDL idempotente. Reset é seguro porque não há produção e o webhook do Clerk + backfill repopulam o banco em seguida.
- Q: Como o papel Postgres restrito do runtime é provisionado? → A: Code-first total via Drizzle migrations, no estilo EF Core / TypeORM. Toda a estrutura do banco — tabelas, RLS, triggers, funções e o **papel restrito** (`CREATE ROLE`, `GRANT`s, sem `BYPASSRLS`) — é declarada em código e materializada por `drizzle-kit migrate`. Nenhum passo manual no Dashboard Supabase nem `psql` ad hoc para replicar a estrutura em outro ambiente; rodar as migrations recria o estado completo.
- Q: Como tratar eventos `organizationMembership.*` que chegam antes de `user.created`/`organization.created` (ordem de entrega não garantida pelo Clerk)? → A: Upsert defensivo. O handler de `organizationMembership.*` MUST primeiro fazer upsert das linhas de `users` e `orgs` correspondentes (com os dados mínimos disponíveis no payload — `public_user_data` e `organization` aninhados no evento), e só então fazer upsert em `org_memberships`. Eventos `user.*`/`organization.*` posteriores enriquecem os registros (upsert idempotente). Sem fila externa, sem retry forçado, sem remoção de FKs.

## User Scenarios & Testing _(mandatory)_

> Audiência: time de engenharia da própria aplicação. Os "usuários" aqui são desenvolvedores, operadores do webhook do Clerk e o próprio runtime serverless.

### User Story 1 — Infraestrutura Drizzle disponível pra novas features (Priority: P1)

Como desenvolvedor da aplicação, preciso de uma camada Drizzle pronta (cliente, configuração, ferramental de migrations e estrutura de schema) para que features posteriores possam declarar tabelas e queries tipadas direto contra o Postgres do Supabase, sem reimplementar o boilerplate.

**Why this priority**: Sem isso, nenhuma feature subsequente que dependa de acesso tipado ao banco consegue avançar. É a fundação da fatia.

**Independent Test**: Pode ser validado executando um smoke test que abre conexão Drizzle e roda `select 1`, mais a execução ponta a ponta de `db:generate` e `db:migrate` em ambiente local, comprovando que o ferramental funciona mesmo antes da nova tabela existir.

**Acceptance Scenarios**:

1. **Given** as variáveis de ambiente `DATABASE_URL` (pooler) e `DATABASE_URL_UNPOOLED` (direta) configuradas, **When** o runtime serverless inicia uma rota e executa uma query trivial via Drizzle, **Then** a conexão é aberta via pooler em modo transação e retorna o resultado sem erro.
2. **Given** o repositório recém-clonado, **When** o desenvolvedor roda `npm run db:generate` após adicionar/alterar um schema em `lib/db/schema/`, **Then** uma migration SQL é gerada em `lib/db/migrations/` refletindo a mudança.
3. **Given** uma migration pendente em `lib/db/migrations/`, **When** o desenvolvedor roda `npm run db:migrate`, **Then** a migration é aplicada contra o Supabase usando a conexão direta e o estado é registrado na tabela de controle do Drizzle.
4. **Given** o bundle de cliente do Next.js, **When** ele é construído, **Then** nenhum módulo Drizzle nem credencial de banco é incluído no bundle do browser.

---

### User Story 2 — Sincronização automática de `org_memberships` via Clerk (Priority: P1)

Como operador da integração Clerk ↔ Supabase, preciso que toda criação, atualização ou remoção de membership de organização no Clerk seja refletida automaticamente na tabela `org_memberships` do Supabase, para que a aplicação tenha uma fonte consultável de quem pertence a qual organização e com qual role.

**Why this priority**: É o resultado funcional visível da fatia. Sem isso, a tabela existe mas não tem dados confiáveis. Todas as features futuras que listam membros ou aplicam permissões por org dependem desta sincronização.

**Independent Test**: Pode ser testado disparando eventos `organizationMembership.*` simulados contra o handler do webhook (testes unitários/integração) e verificando o estado resultante da tabela.

**Acceptance Scenarios**:

1. **Given** um membership recém-criado no Clerk, **When** o evento `organizationMembership.created` chega ao webhook, **Then** uma linha é inserida em `org_memberships` com `(org_id, user_id, role)` correspondentes e `created_at`/`updated_at` preenchidos.
2. **Given** um membership existente cuja role mudou no Clerk (ex.: `org:member` → `org:admin`), **When** o evento `organizationMembership.updated` chega, **Then** a linha correspondente tem `role` atualizada e `updated_at` é avançado, sem duplicar o registro.
3. **Given** um membership removido no Clerk, **When** o evento `organizationMembership.deleted` chega, **Then** a linha correspondente é removida de `org_memberships`.
4. **Given** o mesmo evento entregue duas vezes pelo Clerk (retry), **When** o webhook reprocessa, **Then** o estado final é o mesmo e nenhuma duplicata é criada.

---

### User Story 3 — Backfill de memberships existentes (Priority: P2)

Como operador, preciso popular `org_memberships` com o estado atual de todas as organizações já existentes no Clerk antes/durante a ativação dos novos eventos do webhook, para que a tabela reflita a realidade desde o primeiro deploy e não apenas eventos futuros.

**Why this priority**: Necessário pra evitar gap histórico, mas é executado uma única vez manualmente. Pode ser entregue logo após US1/US2 e não bloqueia o uso da tabela em features novas (que naturalmente criam memberships novos).

**Independent Test**: Executar o script de backfill duas vezes consecutivas contra um ambiente de teste e verificar que (a) todos os memberships existentes no Clerk aparecem em `org_memberships` e (b) a segunda execução não cria duplicatas nem altera dados existentes além de `updated_at`.

**Acceptance Scenarios**:

1. **Given** N organizações no Clerk com M memberships totais, **When** o script de backfill é executado, **Then** ao final há exatamente M linhas em `org_memberships` correspondentes ao estado do Clerk.
2. **Given** uma execução de backfill já concluída, **When** o script roda novamente, **Then** nenhuma linha é duplicada e o resultado final permanece consistente (operação idempotente).
3. **Given** uma falha transiente no meio da execução (ex.: rate limit), **When** o operador reexecuta o script, **Then** ele retoma sem corromper as linhas já gravadas.

---

### User Story 4 — Acesso ao banco respeita o princípio do menor privilégio (Priority: P1)

Como responsável pela segurança da aplicação, preciso que toda conexão Drizzle do runtime use um papel restrito do Postgres (não `postgres`, não `service_role`), sujeito a RLS, para que uma falha de aplicação não exponha dados de outras organizações nem permita escrita administrativa indevida.

**Why this priority**: Restrição não-negociável de segurança. Violar isso compromete o modelo multi-tenant inteiro.

**Independent Test**: Executar `select current_user` via Drizzle e confirmar que o papel retornado é o restrito previsto, não um superuser. Adicionalmente, tentar uma operação de escrita em `org_memberships` a partir do contexto de runtime e confirmar que é bloqueada por RLS.

**Acceptance Scenarios**:

1. **Given** o cliente Drizzle do runtime, **When** executa `select current_user`, **Then** retorna o papel restrito configurado, nunca `postgres` nem `service_role`.
2. **Given** uma requisição autenticada da aplicação, **When** tenta inserir/atualizar/deletar em `org_memberships` via Drizzle, **Then** a operação é rejeitada por RLS.
3. **Given** uma requisição autenticada da aplicação cuja org ativa é `org_X`, **When** seleciona de `org_memberships`, **Then** vê apenas linhas com `org_id = org_X`; linhas de outras orgs nunca são retornadas.
4. **Given** o webhook do Clerk operando com a credencial admin (`sb_secret_...`), **When** processa um evento de membership, **Then** consegue inserir/atualizar/deletar normalmente em `org_memberships`.

---

### Edge Cases

- **Evento de membership chega antes da org ou do user existirem em `public`**: handler executa upsert defensivo de `users` e `orgs` (com dados mínimos do payload) antes do upsert de `org_memberships`; ordem de entrega torna-se irrelevante. Eventos `user.*`/`organization.*` posteriores enriquecem os registros sem sobrescrever campos já populados com `null`.
- **Org removida enquanto memberships ainda existem**: cascade configurado nas FKs garante remoção automática das linhas dependentes em `org_memberships`; comportamento equivalente para remoção de user.
- **Conexão via pooler atinge limite de transações concorrentes**: o cliente Drizzle deve degradar com erro explícito (não travar indefinidamente), permitindo a próxima requisição tentar novamente.
- **Drizzle Kit acidentalmente apontado pra `DATABASE_URL` (pooler) em vez de `DATABASE_URL_UNPOOLED`**: a configuração deve falhar de forma explícita, já que migrations não funcionam confiavelmente sob pooler em modo transação.
- **Schemas Drizzle divergem do estado real do banco**: como a partir desta fatia os schemas em `lib/db/schema/` são a fonte autoritativa (Drizzle dono code-first único), qualquer divergência detectada por `drizzle-kit check`/diff entre schema e banco é tratada como drift do banco vs. código e corrigida por **nova migration versionada** (nunca por DDL manual no Dashboard). Em dev, vale o reset (FR-004b); em ambientes futuros (staging/prod), a correção deve sempre passar por migration.
- **Backfill executado contra ambiente com webhook já ativo**: o uso de upsert idempotente pela PK composta garante que eventos concorrentes do webhook não conflitem com o script.

## Requirements _(mandatory)_

### Functional Requirements

#### Camada Drizzle e ferramental

- **FR-001**: O sistema MUST expor um cliente Drizzle server-side (`lib/db/index.ts`) marcado como `server-only`, configurado contra o pooler do Supabase em modo transação (porta 6543).
- **FR-002**: O ferramental Drizzle Kit MUST usar exclusivamente uma conexão direta (porta 5432, via `DATABASE_URL_UNPOOLED`) para gerar e aplicar migrations.
- **FR-003**: O sistema MUST manter os schemas Drizzle organizados em `lib/db/schema/` com um barrel `index.ts` reexportando todas as tabelas.
- **FR-004**: O sistema MUST declarar schemas Drizzle correspondentes às tabelas `users` e `orgs` já existentes (incluindo colunas, defaults, PKs, índices, RLS e trigger `set_updated_at`) e MUST tornar essas declarações a fonte autoritativa da estrutura dessas tabelas a partir desta fatia.
- **FR-004a**: O sistema MUST portar o conteúdo de `supabase/migrations/0001_clerk_sync_init.sql` (tabelas `users`/`orgs`, policies RLS, trigger/função `set_updated_at`, índices) para a árvore de schemas Drizzle e migrations geradas em `lib/db/migrations/`, sem perda de comportamento. A pasta `supabase/migrations/` MUST ser removida ao final da fatia.
- **FR-004b**: Como o projeto está em estágio inicial (apenas ambiente de dev, tabelas existentes vazias, sem dados a preservar), a transição MUST ser feita por **drop + recreate limpo**: dropar `public.users`, `public.orgs`, suas policies RLS associadas e o trigger/função `set_updated_at` no Supabase de dev antes de aplicar a primeira migration Drizzle. Após o reset, `db:migrate` recria toda a estrutura (incluindo `org_memberships`) a partir de zero. Nenhum mecanismo de baseline ou DDL idempotente MUST ser empregado. O passo de reset MUST ser documentado no `quickstart.md` (comando manual via `psql` ou script `scripts/db-reset-dev.ts`) e MUST ser explícito sobre não ser seguro contra dados de produção (irrelevante aqui, mas registrado para fatias futuras).
- **FR-005**: O sistema MUST persistir migrations geradas em `lib/db/migrations/` e versioná-las no repositório como fonte única da estrutura do banco. Nenhum outro diretório de migrations SQL MUST coexistir no repositório ao final da fatia.
- **FR-006**: O sistema MUST disponibilizar scripts `npm run db:generate` e `npm run db:migrate` funcionais ponta a ponta; `npm run db:studio` é opcional.
- **FR-007**: O bundle do cliente (browser) MUST NOT incluir o cliente Drizzle, drivers Postgres, nem qualquer string de conexão.

#### Tabela `org_memberships`

- **FR-008**: O sistema MUST criar a tabela `public.org_memberships` via migration Drizzle, com colunas `org_id`, `user_id`, `role`, `created_at`, `updated_at`.
- **FR-009**: `org_memberships` MUST ter chave primária composta `(org_id, user_id)` e índice secundário em `(user_id)`.
- **FR-010**: `org_memberships.org_id` MUST referenciar `public.orgs(id)` com `ON DELETE CASCADE`; `org_memberships.user_id` MUST referenciar `public.users(id)` com `ON DELETE CASCADE`.
- **FR-011**: `org_memberships.role` MUST ser `text NOT NULL`, sem `CHECK` constraint e sem enum tipado nesta fatia — qualquer texto não-vazio é aceito pelo banco. Valores em uso atualmente pelo Clerk são `org:admin` e `org:member`; restrição a um conjunto fechado (enum/CHECK/lookup table) e suporte a roles customizadas do Clerk ficam explicitamente para fatia futura.
- **FR-012**: `org_memberships.updated_at` MUST ser atualizado automaticamente em UPDATE, reutilizando o mecanismo de trigger `set_updated_at` já existente no schema Supabase.
- **FR-013**: `org_memberships` MUST ter Row Level Security habilitada.
- **FR-014**: A policy de SELECT em `org_memberships` MUST permitir leitura apenas das linhas onde `org_id` corresponde à org ativa do JWT (`auth.jwt() ->> 'org_id'`); membros enxergam apenas a lista da própria org ativa.
- **FR-015**: `org_memberships` MUST NOT expor policies de INSERT/UPDATE/DELETE para o role `authenticated`; escritas só podem ocorrer via credencial admin (webhook).

#### Sincronização via webhook Clerk

- **FR-016**: O webhook `app/api/webhooks/clerk/route.ts` MUST tratar os eventos `organizationMembership.created`, `organizationMembership.updated` e `organizationMembership.deleted`.
- **FR-017**: Os handlers de `organizationMembership.created` e `organizationMembership.updated` MUST executar upsert idempotente em `org_memberships` pela PK composta `(org_id, user_id)`, atualizando `role` e `updated_at` quando a linha já existir.
- **FR-017a**: Antes do upsert em `org_memberships`, os handlers de `organizationMembership.created` e `organizationMembership.updated` MUST executar upsert defensivo das linhas correspondentes em `public.users` e `public.orgs`, usando os dados mínimos disponíveis no payload do evento de membership (campos aninhados `public_user_data` e `organization`). Esse upsert MUST ser idempotente e MUST NÃO sobrescrever campos com `null`/ausentes quando a linha já contiver dados mais completos vindos de um evento `user.*`/`organization.*` anterior. Resultado: o handler de membership funciona corretamente mesmo se chegar antes dos eventos "oficiais" de criação de user/org.
- **FR-018**: O handler de `organizationMembership.deleted` MUST remover a linha correspondente em `org_memberships`; remover linha inexistente MUST ser tratado como no-op, sem erro.
- **FR-019**: Todas as escritas do webhook MUST usar a credencial admin (`sb_secret_...`) que bypassa RLS; o runtime regular da aplicação NUNCA executa escrita em `org_memberships`.

#### Backfill

- **FR-020**: O sistema MUST disponibilizar um script server-side executável manualmente (`scripts/backfill-memberships.ts`) que itera por todas as organizações existentes no Clerk e popula `org_memberships` com os memberships atuais.
- **FR-021**: O script de backfill MUST ser idempotente: execuções repetidas produzem o mesmo estado final e não criam duplicatas.

#### Segurança e configuração

- **FR-022**: Conexões Drizzle do runtime MUST usar um papel Postgres restrito, sujeito a RLS; o sistema MUST NÃO usar `postgres` (superuser) nem `service_role` como papel de runtime.
- **FR-022a**: O papel restrito do runtime MUST ser criado e configurado por uma migration Drizzle versionada (code-first, no estilo EF Core / TypeORM), incluindo `CREATE ROLE`, `GRANT` necessários para `SELECT`/`INSERT`/`UPDATE`/`DELETE` nas tabelas da aplicação e ausência explícita de `BYPASSRLS`. A senha do papel MUST ser injetada como variável de ambiente no momento da migration (não versionada). Nenhum passo manual de provisionamento no Dashboard Supabase ou `psql` MUST ser necessário para replicar o estado completo em um novo ambiente — `drizzle-kit migrate` recria tudo.
- **FR-023**: O sistema MUST documentar, em `.env.example`, as variáveis `DATABASE_URL` (pooler, porta 6543) e `DATABASE_URL_UNPOOLED` (direta, porta 5432), apenas como placeholders, sem credenciais reais.
- **FR-024**: O sistema MUST NÃO versionar connection strings, credenciais, nem `.env.local`.
- **FR-025**: Nesta fatia, o cliente Drizzle MUST ser usado exclusivamente fora do contexto-por-usuário — i.e., apenas para operações administrativas/sistema (handlers do webhook do Clerk, script de backfill, jobs server-side que não dependem do JWT do usuário final). Dados por-usuário (queries cujo resultado precisa ser filtrado por `auth.jwt() ->> 'sub'` ou `auth.jwt() ->> 'org_id'`) MUST continuar sendo acessados via `@supabase/supabase-js`, que injeta o JWT do Clerk por requisição. Esta fronteira MUST estar documentada no código (comentário em `lib/db/index.ts` ou doc adjacente) e ser revisitada em fatia futura quando/se a propagação de claims via Drizzle for adotada.

#### Qualidade

- **FR-026**: `npm run lint` e `npm run typecheck` MUST passar sem erros após esta fatia.
- **FR-027**: O sistema MUST incluir testes unitários cobrindo helpers de `lib/db/` (incluindo cliente, mappers de evento e cada repository com upserts/deletes mockados) e os três handlers de membership do webhook (created, updated, deleted). MUST incluir testes de integração para handlers, RLS e o papel restrito executando contra **Postgres efêmero** (branch de testes do próprio Supabase via `INTEGRATION_DATABASE_URL`), por exceção justificada ao padrão SQLite em memória do projeto — exceção documentada em `research.md` (R5) e registrada em "Complexity Tracking" do `plan.md`, motivada pela dependência de RLS, triggers, papéis Postgres e `auth.jwt()`, recursos inexistentes em SQLite. Outras fatias continuam seguindo o padrão SQLite.

### Key Entities

- **`org_memberships`**: Tabela de relacionamento que associa um usuário (`user_id`) a uma organização (`org_id`) com uma role (`role`). PK composta `(org_id, user_id)`. Sincronizada exclusivamente pelo webhook do Clerk. Lida pela aplicação sob restrição de RLS por org ativa.
- **`users`**: Tabela existente em `public.users`. A partir desta fatia, sua estrutura passa a ser declarada e versionada via Drizzle (schema + migration). Os dados existentes em produção são preservados; o trigger `set_updated_at` e as policies RLS atuais permanecem.
- **`orgs`**: Tabela existente em `public.orgs`. Mesma condição de `users` — estrutura passa a ser declarada e versionada via Drizzle, sem perda de dados nem alteração de comportamento.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% dos eventos `organizationMembership.{created,updated,deleted}` entregues pelo Clerk resultam no estado correto em `org_memberships`, verificável pelos testes automatizados que cobrem os três handlers e o caso de reentrega (idempotência).
- **SC-002**: Para qualquer organização existente no Clerk, a contagem de memberships em `org_memberships` corresponde exatamente à contagem retornada pela API do Clerk após o backfill, e permanece consistente após duas execuções consecutivas do script.
- **SC-003**: Sob o cliente Drizzle do runtime, uma tentativa de SELECT em `org_memberships` retorna apenas linhas da org ativa em 100% dos casos testados; tentativas de INSERT/UPDATE/DELETE são rejeitadas em 100% dos casos.
- **SC-004**: A consulta `select current_user` via cliente Drizzle de runtime retorna o papel restrito previsto em todos os ambientes (local, CI, produção); nunca retorna `postgres` nem `service_role`.
- **SC-005**: `npm run db:generate` e `npm run db:migrate` rodam ponta a ponta sem intervenção manual num repositório clonado do zero, dadas apenas as variáveis de ambiente documentadas.
- **SC-006**: Smoke test `select 1` via Drizzle pelo pooler executa em ambiente local e CI sem erro.
- **SC-007**: Inspeção do bundle de cliente do Next.js não revela referência a `drizzle-orm`, ao driver Postgres, nem a `DATABASE_URL*`.
- **SC-008**: `npm run lint` e `npm run typecheck` retornam exit code 0.

## Assumptions

- A integração Clerk ↔ Supabase (Third-Party Auth) já está ativa e o JWT do Clerk continua sendo a fonte de claims (`sub`, `org_id`, `org_role`, `role`) para RLS, exatamente como configurado na fatia `001-clerk-auth`.
- A partir desta fatia, Drizzle Kit é o dono único da estrutura do banco. As DDLs hoje em `supabase/migrations/0001_clerk_sync_init.sql` (tabelas `users`/`orgs`, RLS, trigger `set_updated_at`) são portadas para schemas Drizzle e migrations em `lib/db/migrations/`; a pasta `supabase/migrations/` é removida ao final da fatia. Replicação da estrutura em qualquer ambiente passa a depender apenas de `drizzle-kit migrate`.
- O cliente `@supabase/supabase-js` continua coexistindo com Drizzle; migração dos consumidores existentes está explicitamente fora de escopo.
- Roles em `org_memberships.role` são armazenadas como texto livre nesta fatia; um enum tipado e/ou suporte a roles customizadas do Clerk será endereçado em fatia futura.
- O papel Postgres restrito a ser usado pelo runtime segue as convenções de `docs/architecture/02-modelagem-de-dados.md` (papel sujeito a RLS, sem `bypass_rls`) e é criado/atualizado exclusivamente via migration Drizzle versionada — code-first total. A senha do papel é provida via variável de ambiente em tempo de migração e nunca versionada.
- As novas API keys do Supabase (`sb_publishable_...` / `sb_secret_...`) já estão emitidas e em uso; chaves legadas (`anon`, `service_role`) não são tocadas nesta fatia.
- O hostname e a porta corretos do pooler do Supabase em transaction mode (6543) e da conexão direta (5432) estão disponíveis para o projeto em uso.
- Os eventos `organizationMembership.*` serão habilitados manualmente no Dashboard do Clerk como parte do rollout desta fatia (passo operacional documentado no plano/quickstart).
- Soft-delete não é introduzido nesta fatia; remoção de membership é hard-delete via `ON DELETE CASCADE` ou pelo handler de `organizationMembership.deleted`.
