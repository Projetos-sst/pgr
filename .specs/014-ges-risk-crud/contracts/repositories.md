# Contract — Repositório `risks`

Arquivo NOVO: `src/shared/db/repositories/risks.ts`. Espelha `pgr.ts`/`ges.ts`. **Todo** acesso via
`withOrg`; escritas via `auditedTenantWrite(orgId, "risks.write_rejected", …)`; sempre filtra
`eq(risks.orgId, orgId)` (defesa em profundidade além do `withOrg`). Nunca toca `risk_assessments`
nem `control_measures`.

## Imports esperados

```ts
import "server-only";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import type { RiskValues, RiskListItem } from "@/shared/domains/pgr/risk";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { withOrg, type TenantTransaction } from "../with-org";
import { risks, type Risk } from "../schema/risks";
import { ges } from "../schema/ges";
import { auditedTenantWrite } from "./audited-write";
```

## Tipos exportados

```ts
export type ListRisksParams = PageParams & {
  companyId?: string; // filtra via ges.companyId (join)
  workUnitId?: string; // filtra via ges.workUnitId (join)
  gesId?: string; // filtra via risks.gesId
  search?: string; // aplica em risks.description
};
```

## Assinaturas

```ts
export async function listRisks(
  orgId: string,
  params?: ListRisksParams,
): Promise<Paginated<RiskListItem>>;
export async function getRiskById(orgId: string, id: string): Promise<Risk | null>;
export async function createRisk(orgId: string, input: RiskValues): Promise<Risk>;
export async function updateRisk(
  orgId: string,
  id: string,
  input: RiskValues,
): Promise<Risk | null>;
export async function deleteRisk(orgId: string, id: string): Promise<boolean>;
```

## Guard privado (espelha assertWorkUnitInCompany)

```ts
async function assertGesInTenant(
  tx: TenantTransaction,
  orgId: string,
  gesId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: ges.id })
    .from(ges)
    .where(and(eq(ges.orgId, orgId), eq(ges.id, gesId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("ges");
}
```

## Mapeamento de colunas (opcionais → null)

```ts
function toRiskColumns(input: RiskValues) {
  return {
    gesId: input.gesId,
    agentType: input.agentType,
    hazard: input.hazard ?? null,
    description: input.description,
    sources: input.sources ?? null,
    propagation: input.propagation ?? null,
    exposureTime: input.exposureTime ?? null,
    possibleInjuries: input.possibleInjuries ?? null,
    noxiousAgentCode: input.noxiousAgentCode ?? null,
    measurementUnit: input.measurementUnit ?? null,
    concentrationIntensity: input.concentrationIntensity ?? null, // string decimal | null
  };
}
```

## Comportamento por operação

### `listRisks`

- `resolvePageParams(params)` → `{ limit, offset }`.
- `filters: SQL[] = [eq(risks.orgId, orgId)]`; push `eq(risks.gesId, params.gesId)` quando presente;
  push `eq(ges.companyId, params.companyId)` / `eq(ges.workUnitId, params.workUnitId)` quando
  presentes (colunas do join com `ges`); `ilike(risks.description, %search%)` se `search`.
- `innerJoin(ges, and(eq(ges.id, risks.gesId), eq(ges.orgId, orgId)))` — expõe `gesName: ges.name` e
  as colunas `ges.companyId`/`ges.workUnitId` para os filtros.
- `select` projeta `RiskListItem` (`gesName: ges.name`).
- `orderBy(desc(risks.createdAt))`, `.limit/.offset`.
- `total` via `count(*)::int` com o **mesmo** `where` e o **mesmo** `innerJoin(ges)` (necessário
  porque os filtros de empresa/obra referenciam colunas de `ges`).
- Retorna `{ rows, total }`. Tudo dentro de um único `withOrg`.

### `getRiskById`

- `withOrg` → `select().from(risks).where(and(eq(orgId), eq(id))).limit(1)` → `row ?? null` (sem
  join). Reusado pela edição e pelo prefill de reuso.

### `createRisk`

- `auditedTenantWrite(orgId, "risks.write_rejected", () => withOrg(orgId, async (tx) => { … }))`.
- Dentro do tx, ANTES do insert: `await assertGesInTenant(tx, orgId, input.gesId)`.
- `tx.insert(risks).values({ orgId, ...toRiskColumns(input) }).returning()` → `row`.

### `updateRisk`

- Igual ao create quanto ao guard (`gesId` pode mudar) dentro do `withOrg`/`auditedTenantWrite`.
- `tx.update(risks).set({ ...toRiskColumns(input), updatedAt: new Date() })
  .where(and(eq(orgId), eq(id))).returning()` → `row ?? null` (null → a action converte em
  `NotFoundError`).

### `deleteRisk`

- `auditedTenantWrite` + `withOrg` → `tx.delete(risks).where(and(eq(orgId), eq(id)))
  .returning({ id: risks.id })` → `rows.length > 0`. A cascata de
  `risk_assessments`/`control_measures` é do banco (`0012`).

## Erros

| Situação                                          | Mecanismo                                      | Código resultante           |
| ------------------------------------------------- | ---------------------------------------------- | --------------------------- |
| `gesId` inexistente/malformado/cross-tenant       | `assertGesInTenant` → `ReferenceNotFoundError` | `FK_NOT_FOUND` (422)        |
| risco inexistente/cross-tenant (get/update/delete)| retorno `null`/`false`                         | `NOT_FOUND` (404) na action |
| — (sem unique)                                    | —                                              | nunca `DUPLICATE`           |

Nenhum SQL fora deste repositório; nenhuma importação de Drizzle em actions/handlers.
