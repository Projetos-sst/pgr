# Research — Isolamento Multi-Tenant (Phase 0)

Todas as decisões abaixo resolvem os pontos da Technical Context. Não restam
marcadores NEEDS CLARIFICATION.

## 1. Fixação do tenant por transação

**Decision**: O helper `withOrg(orgId, fn)` abre uma `db.transaction()` e, como
primeira instrução, executa `select set_config('app.current_org', ${orgId}, true)`
antes de rodar `fn(tx)`.

**Rationale**:
- `set_config(name, value, is_local=true)` é escopado à transação — equivalente a
  `SET LOCAL`, mas **aceita bind parameter**, o que evita interpolar `orgId` em SQL
  (proteção contra injeção; Princípio V).
- `SET LOCAL app.current_org = ${orgId}` literal **não** aceita parâmetro e exigiria
  concatenação de string — rejeitado.
- Compatível com o pooler em transaction mode: fora da transação o valor não
  persiste, então uma conexão reusada do pool não vaza o tenant anterior (SC-011).
- O harness de integração existente já usa `set_config(..., true)` para
  `request.jwt.claims` (`_helpers/db.ts`), confirmando o padrão.

**Alternatives considered**: `SET LOCAL` literal (injeção); variável de sessão sem
`LOCAL` (vaza no pool); passar `orgId` só no `WHERE` sem GUC (não seria backstop).

## 2. Mecanismo de RLS para o caminho do Drizzle (`app_runtime`)

**Decision**: Policies `USING (organization_id = current_setting('app.current_org', true))`
e `WITH CHECK (...)` aplicadas **`TO app_runtime`**, declaradas via `pgPolicy` no
schema Drizzle e materializadas por migration. O papel é declarado com
`pgRole("app_runtime").existing()` (ele é criado fora do Drizzle — infra step).

**Rationale**:
- Há **dois mecanismos de RLS coexistindo**, e eles não conflitam:
  - **JWT-based** (`auth.jwt() ->> 'org_id'`, `TO authenticated`) — caminho do
    `@supabase/supabase-js` per-usuário, já existente em `orgs`/`users`/`org_memberships`.
  - **GUC-based** (`current_setting('app.current_org')`, `TO app_runtime`) — caminho
    do Drizzle/`withOrg`, introduzido nesta fatia e herdado por cada módulo futuro.
- `app_runtime` não é owner das tabelas (migrations rodam como owner/direct) e não
  tem `BYPASSRLS` — logo o RLS **se aplica de fato** a ele (já validado em
  `least-privilege.test.ts`).
- `current_setting('app.current_org', true)` com o 2º argumento `true` retorna
  `NULL`/vazio quando não setado → nenhuma linha casa → 0 linhas (SC-010, FR-014).

**Alternatives considered**: `FORCE ROW LEVEL SECURITY` no owner (desnecessário —
runtime não é owner); policy `TO public` (amplo demais; preferir o papel explícito);
reusar a policy `auth.jwt()` para o Drizzle (Drizzle não carrega o JWT do Clerk).

## 3. Tabela de demonstração de RLS

**Decision**: Tabela de referência **permanente** `tenant_probe` (nome a confirmar
na implementação), mínima: `id uuid PK`, `organization_id text NOT NULL`, `label text`,
`created_at timestamptz`. Índice em `organization_id`. RLS habilitado + policy GUC +
GRANTs a `app_runtime`. Criada por migration gerada pelo Drizzle Kit (`0003_*`).

**Rationale**: É o exemplo canônico que cada módulo futuro copia (Clarification
2026-06-17). Como ainda não existe tabela de módulo de negócio, uma tabela dedicada
e estável dá alvo determinístico aos testes de isolamento sem acoplar a fatia a um
domínio que ainda não foi modelado.

**Alternatives considered**: tabela efêmera só de teste (não comprova o padrão em
migration/produção); aplicar a uma tabela core existente (as core usam policies
`auth.jwt()`, mecanismo diferente — confundiria o exemplo).

## 4. Onboarding e troca de organização

**Decision**: Usar os componentes nativos do Clerk. Extrair o onboarding do
`(protected)/layout.tsx` (hoje renderiza `<OrganizationList>` inline) para uma rota
dedicada `(protected)/onboarding/page.tsx` com `<CreateOrganization>` +
`<OrganizationList>` (aceitar convite). O shell autenticado exibe
`<OrganizationSwitcher>`. `afterCreateOrganizationUrl`/`afterSelectOrganizationUrl`
apontam para `/dashboard`.

**Rationale**: Clerk é a fonte de verdade do tenant e da organização ativa
(Princípio I / doc 04). A persistência da org ativa entre reloads/sessões é
responsabilidade do Clerk (active organization na sessão) — a aplicação não
implementa storage próprio (SC-006). YAGNI: sem componentes customizados.

**Alternatives considered**: UI custom de criação/seleção (reinventa o Clerk, mais
superfície de bug); cookie próprio de org ativa (duplica o estado do Clerk, risco
de divergir do seletor).

## 5. Bloqueio de acesso sem organização ativa

**Decision**: `requireOrgContext()` (já lança `NoActiveOrgError` quando
`session.orgId` ausente) é o ponto único de resolução do tenant. O
`(protected)/layout.tsx` captura `NoActiveOrgError` e **redireciona para
`/onboarding`** (não mais render inline). Toda Server Action / Route Handler de
negócio chama `requireOrgContext()` no topo (revalida por conta própria — doc 03).
Usuário removido da org ativa cai no mesmo caminho (sem `orgId` na sessão →
`/onboarding`), conforme Clarification.

**Rationale**: Caminho único de recuperação (decisão da clarificação), menos estados
e testes. Não confiar só no `proxy.ts` (Server Actions recebem POST direto).

**Alternatives considered**: bloqueio só no middleware (`proxy.ts`) — insuficiente
para Server Actions; tela de erro intermediária — rejeitada na clarificação.

## 6. Auditoria de fronteira de tenant (FR-020/SC-013)

**Decision**: Pequeno logger estruturado `logTenantEvent` em
`src/shared/tenant/audit-log.ts`, espelhando `logClerkSync` (JSON em `console`).
Emite nos eventos: `tenant.org_switched`, `tenant.access_blocked_no_org`,
`tenant.cross_tenant_rejected`. Campos: `operation`, `requestId`, `orgId`, `userId`,
`outcome`. Nunca inclui PII, segredos ou payloads.

**Rationale**: Reaproveita o padrão de log já existente (sem infra nova — Princípio
II). Dá rastreabilidade ao maior risco do produto. A rejeição cross-tenant do banco
sobe como exceção da query; o wrapper de acesso (`withOrg`/actions) captura e loga.

**Alternatives considered**: serviço de auditoria/tabela `audit_log` dedicada
(YAGNI nesta fatia; pode virar evolução futura); não logar (perde rastreabilidade —
rejeitado na clarificação).

## 7. Estratégia de testes (reconciliação SQLite × Postgres)

**Decision**:
- **Unitários** (jsdom): detecção de "usuário sem organização", regra de bloqueio,
  resolução do `orgId` a partir da sessão — com `auth()` do Clerk mockado, sem DB.
- **Integração app-layer** (node): caminho de bloqueio de Server Actions/Route
  Handlers quando não há org ativa — `auth()` mockado retornando sessão sem `orgId`.
  Não toca o banco; portanto **não usa SQLite** (não há o que substituir).
- **Integração RLS** (node): contra **Postgres efêmero**, reutilizando
  `_helpers/db.ts` (estendido com `withOrg`/`setCurrentOrg` por transação). Cobre o
  caminho crítico (A→só A, B→só B, sem tenant→vazio, troca de org), rejeição de
  escrita cross-tenant (`WITH CHECK`) e não-vazamento fora da transação.

**Rationale**: O backstop de RLS só pode ser provado contra Postgres real (SQLite
não tem RLS/policies/GUC) — exatamente o que a spec justifica e o que o projeto já
faz (`least-privilege.test.ts`). Os testes de bloqueio app-layer são determinísticos
por mock de sessão, sem necessidade de banco substituto. A diretriz de "SQLite em
memória" do CLAUDE.md vale para fatias cuja lógica app-layer toca o banco; nesta
fatia o único caminho de banco é o RLS (Postgres).

> **Sancionado pela constituição v1.2.0** (emenda de 2026-06-17): a cláusula de
> testes de integração agora permite explicitamente Postgres efêmero para fatias
> dependentes de RLS/policies/triggers/`auth.jwt()`/`current_setting`, mantendo
> SQLite como default das demais. Esta fatia se enquadra na exceção.

**Alternatives considered**: forçar SQLite para a camada RLS (impossível — sem RLS);
mock total do banco no teste de isolamento (não provaria o backstop real).
