# Quickstart — Modelo de tenant multiempresa + fundação Gate PRO

Como desenvolver, migrar, testar e validar esta fatia. Reaproveita o ferramental da
`002`/`004`.

## Pré-requisitos

- Node + deps instaladas (`npm install`).
- `.env.local` com (já usados no projeto):
  - `DATABASE_URL` (pooler 6543, papel `app_runtime`) — runtime.
  - `DATABASE_URL_UNPOOLED` (conexão direta, owner) — `drizzle-kit`.
  - Chaves Clerk (webhook signing secret) para o sync.
- Para os testes de RLS (Postgres efêmero), exportar:
  - `INTEGRATION_DATABASE_URL`, `INTEGRATION_APP_RUNTIME_URL`,
    `INTEGRATION_DATABASE_URL_ADMIN` (sem eles, os `describe` de RLS são `skip`).

## Fluxo de schema → migration

```bash
# 1. Editar o schema Drizzle:
#    src/shared/db/schema/orgs.ts            (+plan, +clerk_org_id)
#    src/shared/db/schema/org-memberships.ts (+scoped_company_id)
#    src/shared/db/schema/companies.ts        (NOVO)
#    src/shared/db/schema/index.ts            (+export companies)

# 2. Gerar a migration 0004_*:
npx drizzle-kit generate

# 3. Adicionar à migration o GRANT custom de companies (drizzle-kit não gera GRANT):
#    GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO app_runtime;
#    Garantir ordem: CREATE TABLE companies ANTES do ALTER org_memberships ADD FK.

# 4. Aplicar (owner, conexão direta):
npx drizzle-kit migrate
```

## Rodar

```bash
npm run dev          # http://localhost:3000
npm run lint         # quality gate (constituição)
npx tsc --noEmit     # checagem de tipos (strict)
```

## Testes

```bash
npm run test               # unitários (lógica de negócio) — sem DB
npm run test:integration   # integração: app-layer (SQLite) + RLS (Postgres efêmero)
```

### O que cada nível prova

| Nível                | Substrato                              | Cobre                                                                                                                                                                                                                             |
| -------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                 | mocks                                  | idempotência de `provisionPersonalTenant`; papel `owner`; default `free`; resolução do tenant ativo (1→ele, 0→provisiona/bloqueia); `isSwitcherEligible`; `isTeamManagementAvailable`; resolução de plano/papel pelo tenant ativo |
| Integração app-layer | SQLite em memória / `auth()` mockado   | `user.created` provisiona tenant+owner (idempotente); validação de schema; bloqueio sem tenant ativo                                                                                                                              |
| Integração RLS       | **Postgres efêmero** (`INTEGRATION_*`) | `companies`: A só vê A; sem tenant, vazio; escrita cross-tenant rejeitada; escopo por transação                                                                                                                                   |

> SQLite **não** tem RLS — o backstop de `companies` só é provável contra Postgres real
> (constituição v1.2.0, §exceção). Espelhar `shared/db/tenant-isolation.test.ts`
> (tenant_probe) para `companies-isolation.test.ts`.

## Validar manualmente a fatia

1. **Cadastro → tenant próprio**: criar usuário no Clerk; conferir no banco 1 linha `orgs`
   (`plan='free'`, `clerk_org_id` null) e 1 `org_memberships` `role='owner'` para o `userId`.
2. **Free opera sozinho**: entrar autenticado; conferir que a área autenticada carrega com o
   tenant próprio ativo (sem onboarding/seleção).
3. **Plano**: `SELECT id, plan FROM orgs;` → todo tenant com `free`. Tentar
   `UPDATE orgs SET plan='x'` → rejeitado pelo `CHECK`.
4. **Isolamento de companies**: com `app.current_org` = A, inserir/ler companies; fixar B e
   confirmar 0 linhas de A; sem `set_config`, 0 linhas; inserir company com `org_id=B`
   sob A → rejeitado.
5. **Idempotência**: reenviar o webhook `user.created` → nenhum tenant duplicado.

## Replicar o padrão (próximos módulos)

`companies` é o **primeiro** módulo de negócio a herdar o padrão de `tenant_probe`. Para uma
nova tabela de negócio: coluna `org_id text NOT NULL` + `index(org_id)`, `pgPolicy` GUC
(`USING/WITH CHECK org_id = current_setting('app.current_org', true)` `TO app_runtime`),
`.enableRLS()`, GRANTs custom na migration, e acesso sempre via `withOrg(tenantId, …)`.

## Fora desta fatia (não testar/implementar agora)

Enforcement do Gate PRO; fluxo de convite (envio/aceite) e UI "Equipe e Acessos";
auto-criação de Clerk Org no upgrade; policy de escopo por empresa do `cliente`; seletor de
troca e onboarding multi-tenant; billing. Ver `spec.md` → Out of Scope.
