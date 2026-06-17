# Quickstart — Isolamento Multi-Tenant

## Pré-requisitos

- Papel restrito `app_runtime` (sem `BYPASSRLS`) já provisionado no Postgres
  (infra step) e com GRANTs aplicados por migration (fatia 002).
- `requireOrgContext()` disponível em `src/shared/auth/require-org-context.ts`.
- Clerk com Organizations habilitadas.

## Variáveis de ambiente

| Variável                                                      | Uso                                                                    |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`                                                | Runtime — pooler (6543) como `app_runtime` (sujeito a RLS)             |
| `DATABASE_URL_UNPOOLED`                                       | Migrations — conexão direta como owner (`drizzle-kit`)                 |
| `INTEGRATION_DATABASE_URL` / `INTEGRATION_DATABASE_URL_ADMIN` | Postgres efêmero (owner/admin) p/ aplicar migrations e seed nos testes |
| `INTEGRATION_APP_RUNTIME_URL`                                 | Postgres efêmero conectado como `app_runtime` p/ testes de RLS         |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`      | Clerk                                                                  |

Sem `INTEGRATION_APP_RUNTIME_URL`/`INTEGRATION_DATABASE_URL`, os testes de RLS são
`describe.skip` (mesmo comportamento de `least-privilege.test.ts`).

## Migrations

```bash
npm run db:generate   # gera 0003_* a partir do schema (tenant_probe + policy)
npm run db:migrate    # aplica via conexão direta (owner)
```

A migration deve conter: `CREATE TABLE tenant_probe`, índice, `ENABLE ROW LEVEL
SECURITY`, `CREATE POLICY ... TO app_runtime` (USING + WITH CHECK com
`current_setting('app.current_org', true)`) e `GRANT ... TO app_runtime`.

## Rodar os testes

```bash
npm run test              # unit (jsdom) — bloqueio/resolução de orgId (Clerk mockado)
npm run test:integration  # integração (node) — RLS contra Postgres efêmero
npm run lint && npm run typecheck
```

## Caminho crítico de isolamento (o que os testes provam)

1. Tenant A fixado → consulta sem `WHERE` em `tenant_probe` retorna só linhas de A.
2. Tenant B fixado → só linhas de B.
3. Sem tenant fixado (fora de `withOrg`) → 0 linhas.
4. Escrita de `organization_id` ≠ tenant ativo → rejeitada (`WITH CHECK`).
5. Após `withOrg(A)`, uma query bare subsequente (sem `withOrg`) → 0 linhas
   (escopo não vaza da transação).

## Replicar o padrão num novo módulo

1. Adicione `organization_id text NOT NULL` + índice na tabela.
2. No schema Drizzle, adicione `pgPolicy("<tabela>_isolation", { for:"all",
to: appRuntimeRole, using: …current_setting('app.current_org', true)…,
withCheck: … })` e `.enableRLS()`.
3. Gere a migration e inclua o `GRANT ... TO app_runtime`.
4. Em `queries.ts`/`actions.ts`, receba `orgId` (de `requireOrgContext()`) e use
   `withOrg(orgId, (tx) => …)` com `WHERE organization_id = orgId` explícito.
5. Logue eventos de fronteira via `logTenantEvent` quando aplicável.

Ver `contracts/withorg-and-rls.md` para o contrato completo.
