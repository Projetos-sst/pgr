# Contrato — `withOrg` + RLS (caminho Drizzle / `app_runtime`)

> Nomenclatura canônica: o helper de acesso org-scoped chama-se **`withOrg`**. O
> doc 03 (`03-api-design.md`) refere-se ao conceito como `orgScopedDb`/`withOrg`;
> esta fatia padroniza em `withOrg` em todo o código e nos contratos.

## `withOrg(orgId, fn)`

`src/shared/db/with-org.ts`

```ts
// Executa fn dentro de uma transação com o tenant fixado para o RLS.
export async function withOrg<T>(
  orgId: string,
  fn: (tx: TenantTransaction) => Promise<T>,
): Promise<T>;
```

Comportamento (contrato):

1. Abre `db.transaction(async (tx) => { … })`.
2. Primeira instrução: `await tx.execute(sql\`select set_config('app.current_org', ${orgId}, true)\`)`.
   - `orgId` vai como **bind parameter** — nunca interpolado em string.
3. Executa `fn(tx)` e retorna seu resultado.
4. Ao fim da transação (commit/rollback), o valor de `app.current_org` deixa de
   existir — não vaza para a próxima operação no pool.

Pré-condições:

- `orgId` é o da sessão (`requireOrgContext().orgId`) — nunca de input do cliente.
- A conexão é a do `app_runtime` (pooler, transaction mode).

Garantias verificáveis:

- Dentro de `fn`, uma query **sem** `WHERE organization_id` em uma tabela com RLS
  retorna só linhas do tenant (FR-013).
- Sem `withOrg` (ou com tenant não setado), a mesma query retorna 0 linhas (FR-014,
  SC-011).

## Padrão de policy por tabela (replicável)

Para cada tabela de dados de negócio:

```sql
ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<tabela>_isolation" ON <tabela>
  AS PERMISSIVE FOR ALL TO app_runtime
  USING      (organization_id = current_setting('app.current_org', true))
  WITH CHECK (organization_id = current_setting('app.current_org', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON <tabela> TO app_runtime;
```

Declarado no schema Drizzle:

```ts
export const appRuntimeRole = pgRole("app_runtime").existing(); // roles.ts

pgPolicy("<tabela>_isolation", {
  for: "all",
  to: appRuntimeRole,
  using: sql`${table.organizationId} = current_setting('app.current_org', true)`,
  withCheck: sql`${table.organizationId} = current_setting('app.current_org', true)`,
});
// ... .enableRLS()
```

Invariantes:

- `app_runtime` **não** é owner e **não** tem `BYPASSRLS` (validado em
  `least-privilege.test.ts`).
- A aplicação conecta **somente** como `app_runtime` (FR-017).
- `ENABLE RLS`, policy e GRANT entram via **migration Drizzle Kit** — nunca manual
  (FR-011).
- Mecanismo GUC (`current_setting('app.current_org')`) é **distinto** das policies
  `auth.jwt()`/`authenticated` das tabelas core (caminho supabase-js).

## Uso em `queries`/`actions` (1ª + 2ª barreira)

```ts
export async function listProbes(orgId: string) {
  return withOrg(orgId, (tx) =>
    tx.select().from(tenantProbe).where(eq(tenantProbe.organizationId, orgId)),
  );
}
```

O `WHERE` explícito é a 1ª barreira; o RLS via `withOrg` é a 2ª. Esquecer uma não
vaza dados — a outra ainda filtra.
