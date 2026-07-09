# Contract — Server Actions `pgr`

Arquivo NOVO: `src/shared/server/actions/pgr/pgr.ts` (`"use server"`). Espelha
`actions/pgr/companies.ts`. Toda action envolve `officeAction(operation, fn, opts)` → `ActionResult<T>`.
Validação Zod ANTES do repo. `{ audit: true }` só em create/update/delete. Sem Drizzle importado.
`BASE_PATH = "/pgr"`.

## Imports esperados

```ts
"use server";
import { revalidatePath } from "next/cache";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";
import {
  pgrInputSchema,
  pgrCreateSchema,
  type PgrInput,
  type PgrCreateInput,
  type PgrListItem,
} from "@/shared/domains/pgr/pgr";
import * as repo from "@/shared/db/repositories/pgr";
import type { Pgr } from "@/shared/db/schema/pgr";
```

## Assinaturas + comportamento

```ts
// LIST — sem audit
export async function listPgrAction(
  params: repo.ListPgrParams = {},
): Promise<ActionResult<Paginated<PgrListItem>>> {
  return officeAction("pgr.pgr.list", ({ tenantId }) => repo.listPgr(tenantId, params));
}

// GET — sem audit; null → NOT_FOUND
export async function getPgrAction(id: string): Promise<ActionResult<Pgr>> {
  return officeAction("pgr.pgr.get", async ({ tenantId }) => {
    const row = await repo.getPgrById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

// CREATE — audit; parse pgrCreateSchema (exige aceite), descarta declarationAccepted
export async function createPgrAction(input: PgrCreateInput): Promise<ActionResult<Pgr>> {
  return officeAction(
    "pgr.pgr.create",
    async ({ tenantId }) => {
      const parsed = pgrCreateSchema.parse(input);
      const { declarationAccepted: _accepted, ...values } = parsed; // NÃO persistido
      const row = await repo.createPgr(tenantId, values);
      revalidatePath(BASE_PATH);
      return row;
    },
    { audit: true },
  );
}

// UPDATE — audit; parse pgrInputSchema (sem aceite); null → NOT_FOUND
export async function updatePgrAction(
  id: string,
  input: PgrInput,
): Promise<ActionResult<Pgr>> {
  return officeAction(
    "pgr.pgr.update",
    async ({ tenantId }) => {
      const values = pgrInputSchema.parse(input);
      const row = await repo.updatePgr(tenantId, id, values);
      if (!row) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      revalidatePath(`${BASE_PATH}/${id}`);
      revalidatePath(`${BASE_PATH}/${id}/edit`);
      return row;
    },
    { audit: true },
  );
}

// DELETE — audit; false → NOT_FOUND
export async function deletePgrAction(id: string): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.pgr.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deletePgr(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return { id };
    },
    { audit: true },
  );
}
```

## Reuso (sem novas actions)

- **Opções de empresa** (select-pai do filtro e do form): `listCompanyOptionsAction()` de
  `@/shared/server/actions/pgr/companies` (retorna `CompanyOption[]`).
- **Obras por empresa** (select dependente): `listWorkUnitsAction({ companyId })` de
  `@/shared/server/actions/pgr/work-units` (retorna `Paginated<WorkUnit>`; usar `pageSize: 100`).

Nenhuma action de "options" ou "dependents" nova é criada para `pgr`.

## Mapeamento de erros (via `officeAction` → `toActionError`)

| Erro lançado                                                 | `ActionResult.error.code` |
| ------------------------------------------------------------ | ------------------------- |
| `ZodError` (aceite ausente, datas, tipo↔número, uuid)        | `VALIDATION` (+ `fields`) |
| `NotFoundError` (get/update/delete cross-tenant/inexistente) | `NOT_FOUND`               |
| `ReferenceNotFoundError` (empresa/obra inválida)             | `FK_NOT_FOUND`            |
| `ForbiddenError` (papel `client`, via `requireOfficeStaff`)  | `FORBIDDEN`               |
| `NoTenantContextError`                                       | `NO_TENANT_CONTEXT`       |

Operation strings: `pgr.pgr.{list,get,create,update,delete}`; label de escrita no repo:
`pgr.write_rejected`.
