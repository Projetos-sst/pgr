# Research — Modelo de tenant multiempresa + fundação Gate PRO (Phase 0)

Decisões técnicas que resolvem os "como" deixados abertos pela spec (que define só o
"o quê"/"porquê"). Insumo: `docs/briefing-equipe-acessos-gate-pro.md`, código vigente
(`002`/`003`/`004`) e a constituição v1.2.0.

---

## R1 — Identidade do tenant: manter `orgs.id text` (nosso) + `clerk_org_id` nullable

**Decisão**: Manter `orgs.id` como `text` e torná-lo o **id canônico do tenant gerado por
nós** no cadastro (não mais necessariamente o id da org do Clerk). Adicionar coluna
`clerk_org_id text` **nullable e única**, preenchida só quando o tenant virar PRO (futuro).
O GUC `app.current_org` continua recebendo `orgs.id`.

**Rationale**:

- O briefing (§8) propõe `orgs.id uuid` + `clerk_org_id`. Funcionalmente, um `text`
  carregando um UUID gerado (`gen_random_uuid()::text`) é equivalente para RLS/`withOrg`
  e **evita uma migração destrutiva** `text→uuid` que cascataria em `org_memberships.org_id`
  (FK + PK composta), `tenant_probe`, repositórios e no `clerk-sync-service`. KISS/YAGNI
  (Princípio II): menor mudança que satisfaz a invariante "id canônico e nosso".
- A separação semântica pedida pelo briefing é preservada: **`orgs.id` = nosso id
  canônico**; **`clerk_org_id` = id do Clerk** (camada de UI B2B do PRO, futuro).
- `clerk_org_id` único garante mapeamento 1:1 tenant↔Clerk Org quando existir; nullable
  cobre o free (sem Clerk Org, custo zero — briefing §6.2).

**Alternativas consideradas**:

- **`orgs.id uuid` (briefing literal)**: mais "limpo" no tipo, mas migração destrutiva e
  reescrita ampla de FKs/sync sem ganho funcional nesta fatia. Rejeitada por YAGNI.
- **Reusar `orgs.id` = Clerk org id (status quo `004`)**: impossível no Modelo B — free
  não tem Clerk org; o id do tenant precisa existir antes de qualquer org no Clerk.

---

## R2 — Resolução do tenant ativo a partir das NOSSAS `org_memberships`

**Decisão**: Introduzir `requireTenantContext()` (em `src/shared/auth/`) que resolve o
tenant ativo assim:

1. Obtém `userId` da sessão Clerk (`auth()` / `assertAuthenticated`).
2. Consulta `org_memberships` do `userId` (via caminho admin, fonte da verdade nossa).
3. **0 memberships** → aciona o provisionamento idempotente (R3) e re-resolve; se ainda 0
   (falha), trata como "sem tenant ativo" → bloqueio (caminho da `004`).
4. **exatamente 1 membership** → esse é o tenant ativo (caso dominante do free pós-cadastro).
5. **2+ memberships** → seleção pelo seletor (futuro). Nesta fatia, como múltiplos vínculos
   só nascem de convite (futuro), o caminho prático é sempre 0/1; para 2+ adota-se o último
   tenant ativo persistido (cookie `tenant_active_org` já existente em `org-switch.ts`) ou,
   na ausência, **bloqueio determinístico** (nunca um default ambíguo — spec edge case).
6. Retorna `{ userId, tenantId, plan, role }` para alimentar `withOrg(tenantId, …)`.

**Rationale**:

- Corrige a premissa da `004`: `requireOrgContext()` depende de `session.orgId`, que é nulo
  para o free → quebraria todo free. A resolução por `org_memberships` (Inv-2) torna a
  "org ativa" um conceito **nosso**, free e PRO na mesma lista.
- `requireOrgContext()` é **mantido** para o caminho PRO/Clerk-org (futuro); não é removido,
  evitando regressão na `004`. A nova função coexiste e é a usada pela área autenticada.
- Nunca lê tenant de input do cliente (Princípio I): o id vem de `userId`→memberships.

**Alternativas**:

- **Evoluir `requireOrgContext()` in-place**: arriscaria a `004` (testes/onboarding Clerk).
  Preferida a coexistência explícita e um corte controlado no `layout (protected)`.
- **Persistir `active_tenant_id` na sessão Clerk (publicMetadata)**: acopla ao Clerk o que
  é nosso (viola Inv-2) e exige escrita no Clerk. Rejeitada nesta fatia.

---

## R3 — Provisionamento do tenant pessoal no cadastro (idempotente)

**Decisão**: Uma função única `provisionPersonalTenant(userId, profile?)` que, de forma
**idempotente**, garante: (a) uma linha `orgs` (id gerado, `plan='free'`, `clerk_org_id=null`)
e (b) uma `org_memberships (org_id, user_id, role='owner')`. Idempotência = no-op se o
usuário já possui um membership `owner` de um tenant pessoal. Chamada em **dois pontos** que
delegam à mesma função:

- **Primário**: handler `user.created` do `clerk-sync-service` (após `replaceUser`),
  determinístico e testável — consistente com o sync da `002`.
- **Rede de segurança**: `requireTenantContext()` quando encontra 0 memberships (R2,
  passo 3), cobrindo corrida/atraso de webhook (self-healing).

Persistência via repositório admin (`getRlsBypassingSupabaseClient`), como todo o sync da
`002` (escrita fora de RLS — é provisionamento de sistema, não acesso de tenant).

**Rationale**:

- Atende FR-001 (todo cadastro → tenant próprio + owner) e o default D1 do briefing (sempre
  cria workspace pessoal free; custo zero por não ser Clerk Org).
- Idempotência evita duplicar identidade/tenant em reentregas de webhook (Princípio V;
  Inv-3 "nunca duplica") e em corrida com o passo de self-healing.
- Dois call-sites com uma função evita o race "usuário acessa antes do webhook" sem
  introduzir provisionamento especulativo a cada request (só dispara com 0 memberships).

**Alternativas**:

- **Só webhook**: simples, mas sujeito a atraso → primeiro acesso veria "sem tenant".
- **Só lazy no request**: self-healing, mas sem o ponto determinístico/testável do webhook.
  A combinação (uma função, dois gatilhos) é o equilíbrio robustez × simplicidade.

---

## R4 — `companies` (empresa-cliente) herda o padrão `tenant_probe` (RLS por `org_id`)

**Decisão**: Nova tabela `companies (id uuid PK, org_id text NOT NULL FK→orgs.id, cnpj
text, razao_social text, created_at timestamptz)`. RLS habilitado pelo caminho
`app_runtime`/GUC, policy `companies_isolation FOR ALL TO app_runtime` com
`USING/WITH CHECK (org_id = current_setting('app.current_org', true))` — **idêntico** ao
`tenant_probe` (migration `0003`). GRANTs `SELECT,INSERT,UPDATE,DELETE … TO app_runtime`
como SQL custom na migration. Índice em `(org_id)`; **único `(org_id, cnpj)`** (dedup
intra-tenant); **sem** unicidade global de `cnpj`.

**Rationale**:

- Materializa "empresa-cliente = dado dentro do tenant" (FR-010): isolada por `org_id`,
  **não** é fronteira de isolamento — é a primeira tabela de negócio a herdar o padrão
  provado na `004`.
- Único `(org_id, cnpj)` + ausência de único global em `cnpj` implementa o edge case "mesmo
  CNPJ em dois escritórios = duas empresas distintas" (FR-018) e evita duplicata no mesmo
  tenant.
- A policy de **escopo por empresa do papel `cliente`** (`AND company_id = scoped_company_id`)
  **não** entra agora (fora de escopo); a tabela e o `scoped_company_id` ficam prontos para
  ela.

**Alternativas**:

- **`cnpj` único global**: violaria FR-018 (mesmo CNPJ atendido por dois escritórios).
  Rejeitada.
- **Adiar `companies` para a fatia de CRUD**: a spec inclui a entidade no modelo desta
  fatia (FR-010/FR-018) e ela é necessária para o FK `scoped_company_id`. Mantida.

---

## R5 — Extensões de `org_memberships`: `scoped_company_id` (e papéis)

**Decisão**: Adicionar `scoped_company_id uuid NULL FK→companies.id` (preenchido só para
papel `cliente`; ausente nos demais). Manter `role text`. Os papéis de domínio (nosso, em
inglês) são `owner | collaborator | client` (mapeando `proprietário | colaborador | cliente`);
nesta fatia **apenas `owner`** é escrito (pelo provisionamento). O caminho Clerk-org do PRO
persiste o papel nativo do Clerk (`org:admin | org:member`) — domínio separado, reconciliado
na fatia de convite. **Não** adicionar `status` (suspended/pending) agora — pertence ao
convite e ao downgrade (futuros).

**Rationale**:

- `scoped_company_id` é explicitamente in-scope (FR-016: o vínculo `cliente` registra escopo
  por empresa). FK garante integridade (Princípio V).
- Papel/escopo resolvidos **por vínculo do tenant ativo** (FR-017, Inv-1) — atributo da
  linha de membership, nunca global no usuário.
- `status` (D2 suspender) e `pending` (convite) são marcados _(futuro)_ na spec → YAGNI:
  evitar coluna especulativa; entra na fatia que a usar, sem migração custosa (ALTER ADD).
- Normalização de papel Clerk↔domínio (quando houver Clerk Org PRO) é problema da fatia de
  convite; aqui só geramos `owner`.

**Alternativas**:

- **`role` como enum PG + CHECK agora**: travaria valores antes de a fatia de convite
  definir o mapeamento Clerk↔domínio. Adiada; `text` por ora (consistente com `002`).

---

## R6 — Campo de plano: `orgs.plan` (campo apenas, sem enforcement)

**Decisão**: `orgs.plan text NOT NULL DEFAULT 'free'` + `CHECK (plan IN ('free','pro'))`.
Helper de leitura `resolvePlan(tenant)` e um ponto único `isTeamManagementAvailable(plan)`
que **só** reflete o campo (retorna `plan === 'pro'`) — **sem** bloquear nada nesta fatia
(FR-013 é futuro). O plano é resolvido sempre do **tenant ativo** (Inv-1), nunca do usuário.

**Rationale**:

- Entrega o headline da fatia (FR-011/FR-012) com a garantia no banco (default + CHECK,
  Princípio V): impossível um tenant sem plano ou com valor inválido (SC-006).
- Centralizar a leitura num helper prepara o Gate PRO futuro sem espalhar a regra, mas sem
  implementar enforcement (KISS).

**Alternativas**:

- **Enum PG `plan`**: equivalente; `text`+CHECK é mais simples de evoluir e consistente com
  o estilo atual. Mantido `text`+CHECK.

---

## R7 — Testes: app-layer em SQLite/mocks; isolamento em Postgres efêmero

**Decisão**: Seguir o padrão `004`/constituição v1.2.0:

- **Unitários** (regra de negócio): idempotência do provisionamento, papel `owner`, default
  `free`, resolução do tenant ativo (1→ele; 0→provisiona/bloqueia), elegibilidade de seletor
  (1 vínculo→não; 2+→sim), resolução de plano/papel pelo tenant ativo. Sem DB.
- **Integração app-layer** (SQLite em memória / mocks): handler `user.created` provisiona
  tenant + owner (idempotente); validação de schema; bloqueio quando 0 tenant ativo.
- **Integração RLS** (**Postgres efêmero**, nunca SQLite): `companies` — A só vê A; sem
  tenant, vazio; escrita cross-tenant rejeitada (`WITH CHECK`); escopo por transação.
  Reutiliza o harness `INTEGRATION_*` e espelha `tenant-isolation.test.ts` (tenant_probe).

**Rationale**: O SQLite não tem RLS/policies (constituição §"Exceção"); o backstop de
`companies` só é provável contra Postgres real. O resto (lógica/handlers) roda barato no
default.

---

## Resumo das decisões

| #   | Decisão                                                        | FR/Inv                     | Escopo                                              |
| --- | -------------------------------------------------------------- | -------------------------- | --------------------------------------------------- |
| R1  | `orgs.id text` canônico nosso + `clerk_org_id` nullable único  | FR-001/014                 | agora (id); clerk_org_id agora (coluna), uso futuro |
| R2  | Tenant ativo de `org_memberships` (`requireTenantContext`)     | FR-002/019/020, Inv-2      | agora                                               |
| R3  | `provisionPersonalTenant` idempotente (webhook + self-heal)    | FR-001/003/004, Inv-3, D1  | agora                                               |
| R4  | `companies` herda RLS de `tenant_probe`; único `(org_id,cnpj)` | FR-010/018                 | tabela+RLS agora; escopo `cliente` futuro           |
| R5  | `org_memberships.scoped_company_id`; papéis; sem `status`      | FR-015/016/017             | `scoped_company_id` agora; `status` futuro          |
| R6  | `orgs.plan` NOT NULL default free + CHECK; helper só-leitura   | FR-011/012, Inv-1          | campo agora; enforcement futuro                     |
| R7  | Unit/app em mock/SQLite; RLS em Postgres efêmero               | spec "Definição de pronto" | agora                                               |
