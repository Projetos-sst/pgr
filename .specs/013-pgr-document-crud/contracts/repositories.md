# Contract — Repositório `pgr`

Arquivo NOVO: `src/shared/db/repositories/pgr.ts`. Espelha `companies.ts`/`work-units.ts`. **Todo**
acesso via `withOrg`; escritas via `auditedTenantWrite(orgId, "pgr.write_rejected", …)`; sempre
filtra `eq(pgr.orgId, orgId)` (defesa em profundidade além do `withOrg`). Nunca toca
`pgr_ges`/`pgr_revisions`.

## Imports esperados

```ts
import "server-only";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import type { PgrValues, PgrListItem } from "@/shared/domains/pgr/pgr";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { withOrg, type TenantTransaction } from "../with-org";
import { pgr, type Pgr } from "../schema/pgr";
import { companies } from "../schema/companies";
import { workUnits } from "../schema/work-units";
import { auditedTenantWrite } from "./audited-write";
```

## Tipos exportados

```ts
export type ListPgrParams = PageParams & {
  companyId?: string;
  workUnitId?: string;
  search?: string; // opcional, aplica em responsible
};
```

## Assinaturas

```ts
export async function listPgr(
  orgId: string,
  params?: ListPgrParams,
): Promise<Paginated<PgrListItem>>;
export async function getPgrById(orgId: string, id: string): Promise<Pgr | null>;
export async function createPgr(orgId: string, input: PgrValues): Promise<Pgr>;
export async function updatePgr(
  orgId: string,
  id: string,
  input: PgrValues,
): Promise<Pgr | null>;
export async function deletePgr(orgId: string, id: string): Promise<boolean>;
```

## Guards privados (copiar de work-units.ts / ges.ts)

```ts
async function assertCompanyInTenant(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("company");
}

async function assertWorkUnitInCompany(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
  workUnitId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: workUnits.id })
    .from(workUnits)
    .where(
      and(
        eq(workUnits.orgId, orgId),
        eq(workUnits.id, workUnitId),
        eq(workUnits.companyId, companyId),
      ),
    )
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("work_unit");
}
```

## Comportamento por operação

### `listPgr`

- `resolvePageParams(params)` → `{ limit, offset }`.
- `filters: SQL[] = [eq(pgr.orgId, orgId)]`; push `eq(pgr.companyId, params.companyId)` e
  `eq(pgr.workUnitId, params.workUnitId)` quando presentes; `ilike(pgr.responsible, %search%)` se `search`.
- `innerJoin(companies, eq(companies.id, pgr.companyId))` + `leftJoin(workUnits, eq(workUnits.id, pgr.workUnitId))`.
- `select` projeta `PgrListItem` (`companyName: companies.razaoSocial`, `workUnitName: workUnits.name`).
- `orderBy(desc(pgr.createdAt))`, `.limit/.offset`; `total` via `count(*)::int` com o mesmo `where`
  (join do count só se filtrar por colunas de companies/workUnits — aqui os filtros são em `pgr`, então
  o count roda só sobre `pgr` com o mesmo `where`).
- Retorna `{ rows, total }`. Tudo dentro de um único `withOrg`.

### `getPgrById`

- `withOrg` → `select().from(pgr).where(and(eq(orgId), eq(id))).limit(1)` → `row ?? null` (sem join).

### `createPgr`

- `auditedTenantWrite(orgId, "pgr.write_rejected", () => withOrg(orgId, async (tx) => { … }))`.
- Dentro do tx, ANTES do insert: `await assertCompanyInTenant(tx, orgId, input.companyId)`; se
  `input.workUnitId` presente: `await assertWorkUnitInCompany(tx, orgId, input.companyId, input.workUnitId)`.
- `tx.insert(pgr).values({ orgId, ...toPgrColumns(input) }).returning()` → `row`.
- `toPgrColumns(input)` mapeia com `?? null` os opcionais (`workUnitId`, `responsible`,
  `registrationNumber`); `issuedAt`/`validUntil` são strings ISO; `registrationType` direto.

### `updatePgr`

- Igual ao create quanto aos guards (empresa/obra podem mudar) dentro do `withOrg`/`auditedTenantWrite`.
- `tx.update(pgr).set({ ...toPgrColumns(input), updatedAt: new Date() }).where(and(eq(orgId), eq(id)))
.returning()` → `row ?? null` (null → a action converte em `NotFoundError`).

### `deletePgr`

- `auditedTenantWrite` + `withOrg` → `tx.delete(pgr).where(and(eq(orgId), eq(id))).returning({ id: pgr.id })`
  → `rows.length > 0`. A cascata de `pgr_ges`/`pgr_revisions` é do banco (`0012`).

## Erros

| Situação                                         | Mecanismo                                            | Código resultante           |
| ------------------------------------------------ | ---------------------------------------------------- | --------------------------- |
| empresa inexistente/cross-tenant                 | `assertCompanyInTenant` → `ReferenceNotFoundError`   | `FK_NOT_FOUND` (422)        |
| obra inexistente/cross-tenant/de outra empresa   | `assertWorkUnitInCompany` → `ReferenceNotFoundError` | `FK_NOT_FOUND` (422)        |
| pgr inexistente/cross-tenant (get/update/delete) | retorno `null`/`false`                               | `NOT_FOUND` (404) na action |
| — (sem unique)                                   | —                                                    | nunca `DUPLICATE`           |

Nenhum SQL fora deste repositório; nenhuma importação de Drizzle em actions/handlers.
