# Contract — `lib/db/` public API

**Audience**: server-side consumers (Route Handlers, Server Actions, scripts).
**Stability**: estável dentro desta fatia; semântica das funções não muda em fatias futuras (implementação pode trocar).

---

## `lib/db/index.ts`

```ts
import "server-only";

/**
 * Cliente Drizzle conectado ao Supabase via pooler Supavisor (transaction mode, porta 6543),
 * autenticado como o papel restrito `app_runtime` (sem BYPASSRLS).
 *
 * Escopo nesta fatia: operações administrativas/sistema. NÃO usar para queries cujo
 * resultado depende de claims-por-usuário do JWT do Clerk — essas continuam via
 * `@supabase/supabase-js` (que injeta o token). Ver R3/R4 em research.md.
 */
export const db: PostgresJsDatabase<typeof schema>;
```

**Garantias**:

- `server-only` (build do client quebra se importado no browser).
- `current_user` em qualquer query retorna `'app_runtime'`.
- Reuso seguro entre invocações serverless (driver `postgres-js` com `max: 1`, `prepare: false`, `idle_timeout: 20`).
- Lança em runtime se `DATABASE_URL` ausente ou malformada (porta ≠ 6543).

---

## `lib/db/schema/`

Barrel `lib/db/schema/index.ts` reexporta:

```ts
export { users, type User, type NewUser } from "./users";
export { orgs, type Org, type NewOrg } from "./orgs";
export {
  orgMemberships,
  type OrgMembership,
  type NewOrgMembership,
} from "./org-memberships";
```

**Garantias**:

- Cada arquivo declara: a `pgTable`, o tipo `select` (`InferSelectModel`) e o tipo `insert` (`InferInsertModel`).
- Schemas refletem a DDL aplicada ao banco; divergência é bug.

---

## `lib/db/repositories/`

Wrappers tipados das operações administrativas. Cada função aceita input tipado (derivado de `NewX`) e retorna a row resultante (`X`).

```ts
// lib/db/repositories/org-memberships.ts
export async function upsertOrgMembership(
  input: NewOrgMembership,
): Promise<OrgMembership>;
export async function deleteOrgMembership(args: {
  orgId: string;
  userId: string;
}): Promise<void>;

// lib/db/repositories/users.ts
export async function upsertUser(input: NewUser): Promise<User>;

// lib/db/repositories/orgs.ts
export async function upsertOrg(input: NewOrg): Promise<Org>;
```

**Garantias**:

- Idempotentes: `upsertX` pode ser chamado N vezes com o mesmo input; estado final é determinístico.
- `upsertUser`/`upsertOrg` NÃO sobrescrevem campos com `null`/`undefined` quando a linha já contém valor (`coalesce(excluded.col, table.col)` ou equivalente Drizzle).
- Implementação atual delega ao `getSupabaseAdminClient()` (R4); call sites não dependem disso e podem ser migradas para Drizzle direto em fatia futura sem mudança de assinatura.
- `server-only`.

**Erros**:

- Falha de conexão → `throw` (caller decide retry/HTTP status).
- Constraint violation → `throw` com mensagem original; mapeada em camada superior se necessário.
