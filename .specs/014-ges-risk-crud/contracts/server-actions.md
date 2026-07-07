# Contract — Server Actions `risks`

Arquivo NOVO: `src/shared/server/actions/pgr/risks.ts` (`"use server"`). Espelha
`actions/pgr/pgr.ts`. Toda action envolve `officeAction(operation, fn, opts)` → `ActionResult<T>`.
Validação Zod ANTES do repo. `{ audit: true }` só em create/update/delete. Sem Drizzle importado.
`BASE_PATH = "/risks"`.

## Imports esperados

```ts
"use server";
import { revalidatePath } from "next/cache";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";
import {
  riskInputSchema,
  type RiskInput,
  type RiskListItem,
} from "@/shared/domains/pgr/risk";
import * as repo from "@/shared/db/repositories/risks";
import type { Risk } from "@/shared/db/schema/risks";

const BASE_PATH = "/risks";
```

## Assinaturas + comportamento

```ts
// LIST — sem audit
export async function listRisksAction(
  params: repo.ListRisksParams = {},
): Promise<ActionResult<Paginated<RiskListItem>>> {
  return officeAction("pgr.risks.list", ({ tenantId }) =>
    repo.listRisks(tenantId, params),
  );
}

// GET — sem audit; null → NOT_FOUND. Nome getRiskAction (não getRiskByIdAction).
export async function getRiskAction(id: string): Promise<ActionResult<Risk>> {
  return officeAction("pgr.risks.get", async ({ tenantId }) => {
    const row = await repo.getRiskById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

// CREATE — audit; parse riskInputSchema
export async function createRiskAction(input: RiskInput): Promise<ActionResult<Risk>> {
  return officeAction(
    "pgr.risks.create",
    async ({ tenantId }) => {
      const values = riskInputSchema.parse(input);
      const row = await repo.createRisk(tenantId, values);
      revalidatePath(BASE_PATH);
      return row;
    },
    { audit: true },
  );
}

// UPDATE — audit; corpo completo (mesmo schema); null → NOT_FOUND
export async function updateRiskAction(
  id: string,
  input: RiskInput,
): Promise<ActionResult<Risk>> {
  return officeAction(
    "pgr.risks.update",
    async ({ tenantId }) => {
      const values = riskInputSchema.parse(input);
      const row = await repo.updateRisk(tenantId, id, values);
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
export async function deleteRiskAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.risks.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteRisk(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return { id };
    },
    { audit: true },
  );
}
```

## Reuso (sem novas actions)

- **Opções de empresa** (nível 1 do filtro e do form): `listCompanyOptionsAction()` de
  `@/shared/server/actions/pgr/companies` (`CompanyOption[]`).
- **Obras por empresa** (nível 2, dependente): `listWorkUnitsAction({ companyId, pageSize: 100 })`
  de `@/shared/server/actions/pgr/work-units`.
- **GES por obra** (nível 3, dependente + seletor obrigatório do form): `listGesAction({ workUnitId,
pageSize: 100 })` de `@/shared/server/actions/pgr/ges` (`GesListResult`; usar `rows` → `{id,name}`).
- **Nome do GES no detalhe**: `getGesAction(gesId)` de `@/shared/server/actions/pgr/ges`.
- **Reutilização por prefill**: `getRiskAction(fromId)` na página `/risks/new?from=<id>` para
  pré-preencher o form; o submit usa `createRiskAction`. **Nenhuma** action de clone.

Nenhuma action de "options"/"dependents"/"duplicate" nova é criada para `risks`.

## Mapeamento de erros (via `officeAction` → `toActionError`)

| Erro lançado                                                 | `ActionResult.error.code` |
| ------------------------------------------------------------ | ------------------------- |
| `ZodError` (gesId/agentType/description/enum/qualitative_na) | `VALIDATION` (+ `fields`) |
| `NotFoundError` (get/update/delete cross-tenant/inexistente) | `NOT_FOUND`               |
| `ReferenceNotFoundError` (`gesId` inválido/cross-tenant)     | `FK_NOT_FOUND`            |
| `ForbiddenError` (papel `client`, via `requireOfficeStaff`)  | `FORBIDDEN`               |
| `NoTenantContextError`                                       | `NO_TENANT_CONTEXT`       |

Operation strings: `pgr.risks.{list,get,create,update,delete}`; label de escrita no repo:
`risks.write_rejected`.
