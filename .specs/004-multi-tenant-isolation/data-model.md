# Data Model — Isolamento Multi-Tenant (Phase 1)

Esta fatia não modela módulos de negócio. Introduz **uma** tabela de referência
(demonstração do padrão de RLS) e formaliza a variável de sessão do tenant. As
entidades de identidade vivem no Clerk e na sessão — não no banco.

## Entidades

### `tenant_probe` (tabela de referência permanente)

Exemplo canônico do padrão de isolamento. Mínima de propósito.

| Coluna            | Tipo          | Constraints                                  |
| ----------------- | ------------- | -------------------------------------------- |
| `id`              | `uuid`        | PK, default `gen_random_uuid()`              |
| `organization_id` | `text`        | `NOT NULL`, indexado                         |
| `label`           | `text`        | nullable — só para tornar os testes legíveis |
| `created_at`      | `timestamptz` | `NOT NULL`, default `now()`                  |

**Índice**: `idx_tenant_probe_organization_id` em `(organization_id)`.

**RLS**: habilitado (`ENABLE ROW LEVEL SECURITY`).

**Policy** `tenant_probe_isolation`, `TO app_runtime`, `FOR ALL`:

- `USING (organization_id = current_setting('app.current_org', true))`
- `WITH CHECK (organization_id = current_setting('app.current_org', true))`

**GRANTs**: `select, insert, update, delete on public.tenant_probe to app_runtime`
(na mesma migration).

**Declaração**: `src/shared/db/schema/tenant-probe.ts` via `pgTable` + `pgPolicy`
(`to: appRuntimeRole`, `for: "all"`), `.enableRLS()`. `appRuntimeRole` =
`pgRole("app_runtime").existing()` em `src/shared/db/roles.ts`. Migration `0003_*`
gerada por `drizzle-kit generate`; GRANTs adicionados como SQL custom na migration.

> Distinção importante: as tabelas core (`orgs`/`users`/`org_memberships`) usam
> policies `auth.jwt()` `TO authenticated` (caminho supabase-js). `tenant_probe`
> usa o caminho GUC/`app_runtime` — o que os módulos de negócio herdarão.

### Tenant ativo da transação (variável de sessão)

| Item       | Valor                                                                    |
| ---------- | ------------------------------------------------------------------------ |
| Nome       | `app.current_org`                                                        |
| Origem     | `orgId` da sessão Clerk (`requireOrgContext`)                            |
| Escopo     | Transação (`set_config(..., true)`)                                      |
| Setado por | `withOrg(orgId, fn)` — primeira instrução da transação                   |
| Ausente    | `current_setting('app.current_org', true)` → vazio → 0 linhas de negócio |

### Sessão / Organização ativa (Clerk — não persistido no nosso banco)

- `userId`, `orgId`, `orgRole`, `orgSlug` derivados de `auth()`.
- A **organização ativa** e sua persistência entre sessões são responsabilidade do
  Clerk; a aplicação apenas lê via `requireOrgContext()`.
- Memberships consultáveis em `org_memberships` (sincronizadas por webhook — fatia
  002); determinam quais empresas o usuário pode selecionar.

## Regras de validação / integridade

- `organization_id` `NOT NULL` em toda tabela de negócio (aqui, `tenant_probe`).
- Escrita só passa se `organization_id` == tenant ativo (RLS `WITH CHECK`) — FR-015.
- Leitura sem filtro explícito ainda é filtrada pelo RLS (FR-013); sem tenant ativo,
  vazio (FR-014).
- `orgId` nunca vem de input do cliente (FR-008) — sempre da sessão.

## Transições de estado (contexto de tenant na aplicação)

```
[autenticado, sem org ativa]
      │  acessa área (app)
      ▼
[/onboarding] ──criar org──▶ [org ativa = nova] ──▶ [/dashboard]
      │
      └──aceitar convite──▶ [org ativa = empresa do convite] ──▶ [/dashboard]

[org ativa = A] ──troca no <OrganizationSwitcher>──▶ [org ativa = B]
      (dados exibidos passam 100% a ser de B; nada de A permanece)

[org ativa = A] ──removido de A / perde acesso──▶ [sem org ativa] ──▶ [/onboarding]
```
